import { db } from '../util/DB';
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
	if (!latestFile) {
		Logger.info('No new import was found');

		return;
	}

	const file = await S3.getFile(latestFile);

	const fileAt = new Date(latestFile.split('/').reverse()[0].split('.json.gz')[0]);
	const payload: IFileContents = JSON.parse(file);

	const ids = await GameServerPing.bulkCreate(payload.servers.map(server => getGameServerPing(fileAt, server)));

	// Create missing rows
	await GameServer.bulkCreate(payload.servers.map(server => {
		const meta = server.payload === null ? {
			lastFailedPing: fileAt,
		} : {
				lastSuccessfulPing: fileAt,
				lastPingId: ids.find(i => i.address === server.hostname).id,
			};

		return {
			ip: server.ip.address,
			address: server.hostname,
			createdAt: fileAt,
			port: server.port,
			...meta,
		};
	}), { updateOnDuplicate: ['lastFailedPing', 'lastSuccessfulPing', 'lastPingId'] });
});

(async () => {
	while (true) {
		await doStuff();

		await new Promise(res => {
			setTimeout(res, 100);
		});
	}
})()
	.catch((e: Error) => {
		Logger.error('Error occurred with import', e);
	});

