import { Asn, CountryRecord } from '@maxmind/geoip2-node';
import Query, { QueryResponse } from '@sagl/samp-query';
import got from 'got';
import { pick } from 'lodash';
import PQueue from 'p-queue';
import pRetry from 'p-retry';

import { Logger } from '../util/Logger';
import { lookupIP } from '../util/MaxMind';
import { GameServer } from './../models/GameServer';
import { S3 } from './../util/S3';

import '../util/DB';

export interface IQueryValue {
	hostname: string;
	port: number;
	hosted: boolean;
	payload: QueryResponse;
	ip: { address: string; asn: Asn; country: string; city: string | null };
}

export interface IFileContents {
	servers: IQueryValue[];
}

// tslint:disable no-http-string
async function getServers(): Promise<{ servers: string[]; hosted: Set<string> }> {
	const servers = await GameServer.findAll({}).then(i => i.map(e => `${e.ip}:${e.port}`));
	const internet: string = (await got.get('http://lists.sa-mp.com/0.3.7/internet')).body.trim();
	const hosted: string = (await got.get('http://lists.sa-mp.com/0.3.7/hosted')).body.trim();

	return {
		servers: Array.from(new Set([...servers, ...internet.split('\n'), ...hosted.split('\n')])),
		hosted: new Set([...hosted.split('\n')]),
	};
}

function queryServer(address: string, hosted: boolean): Promise<IQueryValue> {
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
	} catch(e) { }

	return pRetry(() => {
		return Query({ host: hostname, port: +port, timeout: 5000 })
			.then((response) => {
				Logger.info('Pinged server.', { id: `${hostname}:${port}` });

				return {
					hostname: address,
					port: +port,
					hosted,
					payload: response,

					ip: {
						address: hostname,
						asn: pick(asn, ['autonomousSystemOrganization', 'autonomousSystemNumber']),
						country: (<CountryRecord>city.country).isoCode,
						city: (<CountryRecord>city.city).names ? (<CountryRecord>city.city).names.en : null,
					},
				};
			})
	}, { retries: 3 })
	.catch(() => {
		Logger.warn('Failed to ping server.', { id: `${hostname}:${port}` });

		return {
			hostname: address,
			port: +port,
			hosted,
			payload: null,
			ip: {
				address: hostname,
				asn: pick(asn, ['autonomousSystemOrganization', 'autonomousSystemNumber']),
				country: (<CountryRecord>city.country).isoCode,
				city: (<CountryRecord>city.city).names ? (<CountryRecord>city.city).names.en : null,
			},
		}
	});
}

(async () => {
	const startAt = new Date();

	// Fetch the server listing.
	const { servers, hosted } = await getServers();
	Logger.info('Fetched servers', { count: servers.length });

	const queue = new PQueue({ concurrency: 20 });
	const serverResults: IQueryValue[] = [];

	queue.addAll(servers.map(srv => () => {
		return queryServer(srv, hosted.has(srv))
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

	const payload = JSON.stringify({
		servers: serverResults,
	});

	const file: string =
		`polls/${startAt.getFullYear()}/${startAt.getUTCMonth() + 1}/${startAt.getUTCDate()}/${startAt.toISOString()}.json.gz`;
	await S3.upload(file, payload, 'application/json');

	Logger.info('Uploaded to GCS', { file });

	const hosts = serverResults.map(i => ({
		ip: i.ip.address,
		port: i.port,
	}));

	await GameServer.bulkCreate(hosts, {
		ignoreDuplicates: true,
	});
})().catch((e) => { console.log(e); }); // tslint:disable-line
