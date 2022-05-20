import { Point } from '@influxdata/influxdb-client';
import { pick } from 'lodash';

import { db } from '../util/DB';
import { getWriter } from '../util/Influxdb';
import { S3 } from '../util/S3';
import { GameServer } from './../models/GameServer';
import { GameServerPing } from './../models/GameServerPing';
import { Logger } from './../util/Logger';
import { IFileContents, IQueryValue } from './batchPing';

/**
 * Returns the timestamp of the last imported ping run.
 */
export async function getLastExport(): Promise<Date> {
	const gamePing = await GameServerPing.findOne({ order: [['batchPingedAt', 'desc']], limit: 1 });

	if (gamePing) {
		return new Date(+gamePing.batchPingedAt + 1000);
	}

	return new Date(0);
}

export function getGameServerPing(pingedAt: Date, server: IQueryValue): any {
	if (!server.payload) {
		return {
			address: server.hostname,
			ip: server.ip.address,
			port: server.port,
			hosted: server.hosted,
			sacnr: server.sacnr ?? false,
			openmp: server.openmp ?? false,
			online: false,
			batchPingedAt: pingedAt,
		};
	}

	return {
		address: server.hostname,
		ip: server.ip.address,
		port: server.port,
		online: true,
		hosted: server.hosted,
		sacnr: server.sacnr ?? false,
		openmp: server.openmp ?? false,
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

async function seedDatabase(pingedAt: Date, queryServers: IQueryValue[]): Promise<void> {
	const ids = await GameServerPing.bulkCreate(queryServers.map(server => getGameServerPing(pingedAt, server)));
	const servers = await GameServer.findAll({});
	const create = [];

	for (const server of queryServers) {
		const meta = server.payload === null ? {
			lastFailedPing: pingedAt,
		} : {
				lastSuccessfulPing: pingedAt,
				lastPingId: ids.find(i => i.address === server.hostname).id,
				assumedDiscordGuild: server.guild?.id ?? null,
				assumedIcon: server.guild?.avatar  ??  null,
			};

		const upsertData = {
			ip: server.ip.address,
			address: server.hostname,
			createdAt: pingedAt,
			port: server.port,
			sacnr: server.sacnr ?? false,
			openmp: server.openmp ?? false,
			...meta,
		};

		const srv = servers.find(i => i.address === server.hostname);
		if (srv) {
			await srv.update(pick(upsertData, ['lastFailedPing', 'lastSuccessfulPing', 'lastPingId', 'assumedDiscordGuild', 'assumedIcon']));
		} else {
			create.push(upsertData);
		}
	}

	await GameServer.bulkCreate(create);
}

async function seedInflux(pingedAt: Date, queryServers: IQueryValue[]): Promise<void> {
	const writer = getWriter();

	for (const server of queryServers) {
		if (server.payload) {
			writer.writePoint(
				new Point('server')
					.intField('maxPlayers', server.payload.maxplayers)
					.intField('players', server.payload.online)
					.intField('ping', server.payload.ping)
					.tag('address', `${server.ip.address}:${server.port}`)
					.tag('city', `${server.ip.city ?? 'unknown'}`)
					.tag('country', `${server.ip.country ?? 'unknown'}`)
					.tag('asnName', `${server.ip.asn.autonomousSystemOrganization ?? 'unknown'}`)
					.tag('asnId', `${server.ip.asn.autonomousSystemNumber ?? 'unknown'}`)
					.tag('version', `${server.payload.rules.version ?? 'unknown'})`)
					.tag('origin', server.hosted ? 'hosted' : server.openmp ? 'openmp' : server.sacnr ? 'sacnr' : 'sagl')
					.timestamp(pingedAt),
			);
		}
	}

	await writer.close();
}

const doStuff = (async () => {
	await db.authenticate();

	const latestFile: string = await getFiles(await getLastExport());
	if (!latestFile) {
		Logger.info('No new import was found');
		process.exit(0);
	}

	const file = await S3.getFile(latestFile);

	const fileAt = new Date(latestFile.split('/').reverse()[0].split('.json.gz')[0]);
	const payload: IFileContents = JSON.parse(file);

	if ((await GameServerPing.count({ where: { batchPingedAt: fileAt }})) >= 1) {
		Logger.warn('Already ingested data, skipping!');

		return;
	}

	await seedDatabase(fileAt, payload.servers);
	await seedInflux(fileAt, payload.servers);
});

(async () => {
	await doStuff();
})()
	.catch((e: Error) => {
		Logger.error('Error occurred with import', e);
	});
