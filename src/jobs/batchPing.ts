import { Asn, CountryRecord } from '@maxmind/geoip2-node';
import { ISAMPQuery, query }from '@xeonr/samp-query';
import got from 'got';
import { pick } from 'lodash';
import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { Op } from 'sequelize';

import { GameServerBlacklist } from '../models/GameServerBlacklist';
import { inferSocials } from '../routes/server/servers';
import '../util/DB';
import { getInvite, IPartialGuild } from '../util/Discord';
import { Logger } from '../util/Logger';
import { lookupIP } from '../util/MaxMind';
import { GameServer } from './../models/GameServer';
import { redisPub } from './../util/Redis';
import { S3 } from './../util/S3';

export interface IQueryValue {
	hostname: string;
	port: number;
	hosted: boolean;
	sacnr?: boolean;
	payload: ISAMPQuery;
	ip: { address: string; asn: Asn; country: string; city: string | null };
	guild?: IPartialGuild;
}

export interface IFileContents {
	servers: IQueryValue[];
}

/**
 * Get the SACNR master list.
 *
 * This returns a list of all servers on the SACNR master list. The value is cached for 6 hours
 * to ensure we're not hitting them too often.
 */
async function getSacnr(): Promise<string[]> {
	try {
		const list = await redisPub.get('sacnr');

		if (list) {
			return JSON.parse(list);
		}

		const newList = (await got.get('http://monitor.sacnr.com/list/masterlist.txt')).body.trim().split('\n');

		if (newList.length) {
			await redisPub.setex('sacnr', 60 * 60 * 6, JSON.stringify(newList));
		}

		return newList;
	} catch (e) {
		Logger.warn(e.message);

		return [];
	}
}

// tslint:disable no-http-string
async function getServers(): Promise<{ servers: string[]; hosted: Set<string>; sacnr: Set<string>; blacklisted: Set<string> }> {
	const servers = await GameServer.findAll({}).then(i => i.map(e => `${e.ip}:${e.port}`));
	const notViaSacnr = await GameServer.findAll({ where: { sacnr: false }}).then(i => i.map(e => `${e.ip}:${e.port}`));
	const blacklisted = await GameServerBlacklist.findAll({ where: { expiresAt: { [Op.gt]: new Date() } } }).then(i => i.map(e => e.address));
	const internet: string = (await got.get('http://lists.sa-mp.com/0.3.7/internet')).body.trim();
	const hosted: string = (await got.get('http://lists.sa-mp.com/0.3.7/hosted')).body.trim();
	const sacnr: string[] = await getSacnr();

	return {
		servers: Array.from(new Set([...servers, ...internet.split('\n'), ...sacnr, ...hosted.split('\n')])),
		hosted: new Set([...hosted.split('\n')]),
		// We consider a server from sacnr if it's not on the internet/hosted list and it wasn't tracked in our internal DB first.
		// If we identify server from SACNR, it will always be attributed to them.
		sacnr: new Set([...sacnr.filter(i => !internet.includes(i) && !hosted.includes(i) && !notViaSacnr.includes(i))]),
		blacklisted: new Set([...blacklisted]),
	};
}

function queryServer(address: string, hosted: boolean, sacnr: boolean): Promise<IQueryValue> {
	const [hostname, port] = address.split(':');

	let asn: any = {
		autonomousSystemOrganization: null,
		autonomousSystemNumber: null,
	};
	let city: any = {
		isoCode: null,
		names: null,
	};

	try {
		const res = lookupIP(hostname);
		asn = res.asn;
		city = res.city;
	} catch (e) { }

	return pRetry(() => {
		return query({ host: hostname, port: +port, timeout: 5000 })
			.then((response) => {
				Logger.info('Pinged server.', { id: `${hostname}:${port}` });

				return {
					hostname: address,
					port: +port,
					hosted,
					payload: response,
					sacnr,
					ip: {
						address: hostname,
						asn: pick(asn, ['autonomousSystemOrganization', 'autonomousSystemNumber']),
						country: (<CountryRecord>city.country).isoCode,
						city: (<CountryRecord>city.city).names ? (<CountryRecord>city.city).names.en : null,
					},
				};
			});
	}, { retries: 2 })
	.catch(() => {
		Logger.warn('Failed to ping server.', { id: `${hostname}:${port}` });
		const offset = Math.round(Math.random() * (1000 * 60 * 60 * 24));
		GameServerBlacklist.create({ address, expiresAt: new Date(+new Date() + (1000 * 60 * 60 * 24) + offset) })
			.catch(() => {
				// hmm
			});

		return {
			hostname: address,
			port: +port,
			hosted,
			sacnr,
			payload: null,
			ip: {
				address: hostname,
				asn: pick(asn, ['autonomousSystemOrganization', 'autonomousSystemNumber']),
				country: (<CountryRecord>city.country).isoCode,
				city: (<CountryRecord>city.city).names ? (<CountryRecord>city.city).names.en : null,
			},
		};
	});
}

(async () => {
	const startAt = new Date();

	// Fetch the server listing.
	const { servers, sacnr, hosted, blacklisted } = await getServers();
	Logger.info('Fetched servers', { count: servers.length });

	const queue = new PQueue({ concurrency: 20 });
	let serverResults: IQueryValue[] = [];

	queue.addAll(servers.map(srv => () => {
		if (blacklisted.has(srv)) {
			return null;
		}

		return queryServer(srv, hosted.has(srv), sacnr.has(srv))
			.then(i => {
				serverResults.push(i);
			})
			.catch(() => {
				return null;
			});
	}));

	await queue.onIdle();

	Logger.warn('Data fetching complete.', {
		success: serverResults.length,
		failed: servers.length - serverResults.filter(i => !!i.payload).length,
		tookMs: +new Date() - +startAt,
	});

	// Fetch guilds for any servers.
	serverResults = await Promise.all(serverResults.map(async result => {
		if (!result.payload) {
			return result;
		}

		const url = inferSocials(result.payload?.rules.weburl);

		if (!url.has('discord')) {
			return result;
		}

		return {
			...result,
			guild: await getInvite(url.get('discord')),
		};
	}));

	// Prepare and upload
	const payload = JSON.stringify({
		servers: serverResults,
	});
	const file: string =
		`polls/${startAt.getFullYear()}/${startAt.getUTCMonth() + 1}/${startAt.getUTCDate()}/${startAt.toISOString()}.json.gz`;

	await S3.upload(file, payload, 'application/json');

	Logger.info('Uploaded to GCS', { file });

	// Cache any new hosts we found along the way.
	const hosts = serverResults.map(i => ({
		address: i.hostname,
		ip: i.ip.address,
		port: i.port,
		sacnr: i.sacnr,
	}));

	await GameServer.bulkCreate(hosts, {
		ignoreDuplicates: true,
	});

	process.exit(0);
})().catch((e) => { console.log(e); }); // tslint:disable-line
