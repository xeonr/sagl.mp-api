import { Asn, CountryRecord } from '@maxmind/geoip2-node';
import Query, { QueryResponse } from '@sagl/samp-query';
import got from 'got';
import { pick } from 'lodash';
import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { promisify } from 'util';
import { gzip } from 'zlib';

import { Logger } from '../util/Logger';
import { lookupIP } from '../util/MaxMind';
import { GameServer } from './../models/GameServer';
import { S3 } from './../util/S3';

import '../util/DB';

const gzipPromise: (buf: Buffer) => Promise<Buffer> = promisify(gzip);

export interface IQueryValue {
	address: string;
	hosted: boolean;
	payload: QueryResponse;
	ip: { asn: Asn; country: string; city: string | null };
}

export interface IFileContents {
	servers?: { [key: string]: IQueryValue };
	success?: { [key: string]: IQueryValue };
	failed?: string[];
}

// tslint:disable no-http-string
async function getServers(): Promise<{ servers: string[]; hosted: Set<string> }> {
	const servers = await GameServer.findAll({}).then(i => i.map(e => `${e.address}:${e.port}`));
	const internet: string = (await got.get('http://lists.sa-mp.com/0.3.7/internet')).body.trim();
	const hosted: string = (await got.get('http://lists.sa-mp.com/0.3.7/hosted')).body.trim();

	return {
		servers: Array.from(new Set([...servers, ...internet.split('\n'), ...hosted.split('\n')])),
		hosted: new Set([...hosted.split('\n')]),
	};
}

async function queryServer(ip: string, hosted: boolean, map: Map<string, IQueryValue>): Promise<void> {
	const [address, port] = ip.split(':');

	return Query({
		host: address,
		port: +port,
	}).then(r => {
		const { asn, city } = lookupIP(address);
		map.set(ip, {
			address: ip,
			hosted,
			payload: r,
			ip: {
				asn: pick(asn, ['autonomousSystemOrganization', 'autonomousSystemNumber']),
				country: (<CountryRecord>city.country).isoCode,
				city: (<CountryRecord>city.city).names ? (<CountryRecord>city.city).names.en : null,
			},
		});
	});
}

(async () => {
	const startAt = new Date();

	const { servers, hosted } = await getServers();
	Logger.info('Fetched servers', { count: servers.length });

	const queue = new PQueue({ concurrency: 20 });
	const map = new Map<string, IQueryValue>();

	for (const srv of servers) {
		queue.add(() => pRetry(() => queryServer(srv, hosted.has(srv), map), { retries: 3 }).catch(() => {
			const [address] = srv.split(':');
			const { asn, city } = lookupIP(address);

			map.set(srv, {
				address: srv,
				hosted: hosted.has(srv),
				payload: null,
				ip: {
					asn: pick(asn, ['autonomousSystemOrganization', 'autonomousSystemNumber']),
					country: (<CountryRecord>city.country).isoCode,
					city: (<CountryRecord>city.city).names ? (<CountryRecord>city.city).names.en : null,
				},
			});
		}))
			.catch(() => null);
	}

	await queue.onEmpty();

	Logger.warn('Retries failed.', { success: map.size, failed: servers.length - map.size });

	const pl = Array.from(map).reduce((obj, [key, value]) => {
		obj[key] = value;

		return obj;
	}, {});

	const payload = JSON.stringify({
		servers: pl,
	});

	const file: string =
		`polls/${startAt.getFullYear()}/${startAt.getUTCMonth() + 1}/${startAt.getUTCDate()}/${startAt.toISOString()}.json.gz`;
	await S3.upload(file, await gzipPromise(Buffer.from(payload)), 'application/json', 'gzip');
	Logger.info('Uploaded to S3', { file });
})().catch((e) => { console.log(e); }); // tslint:disable-line
