import { CountryRecord } from '@maxmind/geoip2-node';
import { pick } from 'lodash';
import { promisify } from 'util';
import { gunzip } from 'zlib';

import { db } from '../util/DB';
import { lookupIP } from '../util/MaxMind';
import { S3 } from '../util/S3';
import { GameServer } from './../models/GameServer';
import { GameServerPing } from './../models/GameServerPing';
import { Logger } from './../util/Logger';
import { IFileContents, IQueryValue } from './batchPing';

const pGunzip = promisify(gunzip);

export function getServerList(payload: IFileContents): IQueryValue[] {
	if (payload.servers?.length) {
		return Object.values(payload);
	}

	const servers = Object.keys(payload.success).map(i => ({
		address: i,
		...payload.success[i],
	}));

	return servers.concat(payload.failed.map(srv => {
		const [address] = srv.split(':');
		const { asn, city } = lookupIP(address);

		return {
			address: srv,
			hosted: true,
			payload: null,
			ip: {
				asn: pick(asn, ['autonomousSystemOrganization', 'autonomousSystemNumber']),
				country: (<CountryRecord>city.country).isoCode,
				city: (<CountryRecord>city.city).names ? (<CountryRecord>city.city).names.en : null,
			},
		};
	}));
}

/**
 * Returns the timestamp of the last imported ping run.
 */
export async function getLastExport(): Promise<Date> {
	const gamePing = await GameServerPing.findOne({ order: [['batchPingedAt', 'desc']], limit: 1 });

	if (gamePing) {
		return gamePing.batchPingedAt;
	}

	return new Date(0);
}

export function getGameServerPing(pingedAt: Date, server: IQueryValue): any {
	const [address, port] = server.address.split(':');

	if (!server.payload) {
		return {
			address,
			port,
			hosted: server.hosted,
			online: false,
			batchPingedAt: pingedAt,
		};
	}

	return {
		address,
		port,
		online: true,
		hosted: server.hosted,
		hostname: server.payload.hostname,
		gamemode: server.payload.gamemode,
		language: server.payload.language,
		passworded: server.payload.passworded,
		maxPlayers: server.payload.maxplayers,
		onlinePlayers: server.payload.online,
		ping: server.payload.ping,
		lagcomp: server.payload.rules.lagcomp,
		mapname: server.payload.rules.mapname,
		version: server.payload.rules.version,
		weather: server.payload.rules.weather,
		weburl: server.payload.rules.weburl,
		worldtime: server.payload.rules.worldtime,
		country: server.ip.country,
		asn: server.ip.asn.autonomousSystemNumber,
		asnName: server.ip.asn.autonomousSystemOrganization,
		batchPingedAt: pingedAt,
		players: server.payload.players || [],
	};
}

/**
 * Get the latest file from S3.
 *
 * @param since Time to look for files after.
 */
export function getFiles(since: Date): Promise<string | undefined> {
	return S3.listFiles('polls/')
		.then(res => {
			return res.map<[Date, string]>(i => {
				const [filename] = i.split('/').reverse();
				const date = new Date(filename.split('.json.gz')[0]);

				return [date, i];
			})
				.filter(date => {
					return date[0] > since;
				})
				.map(i => i[1])[0];
		});
}

const doStuff = (async () => {
	await db.authenticate();

	const latestFile: string = await getFiles(await getLastExport());
	const file = await S3.getFile(latestFile);
	const fileAt = new Date(latestFile.split('/').reverse()[0].split('.json.gz')[0]);

	const payload: IFileContents = JSON.parse((await pGunzip(file)).toString());

	const servers = getServerList(payload);

	// Create missing rows
	await GameServer.bulkCreate(servers.map(server => {
		const [address, port] = server.address.split(':');

		const meta = server.payload === null ? {
			lastFailedPing: fileAt,
		} : {
				lastSuccessfulPing: fileAt,
			};

		return {
			ip: server.address,
			createdAt: fileAt,
			address,
			port,
			...meta,
		};
	}), { updateOnDuplicate: ['lastFailedPing', 'lastSuccessfulPing'] });

	await GameServerPing.bulkCreate(servers.map(server => getGameServerPing(fileAt, server)));
});

(async () => {
	// while (true) {
	await doStuff();
	// }
})()
	.catch((e: Error) => {
		Logger.error('Error occurred with import', e);
	});

