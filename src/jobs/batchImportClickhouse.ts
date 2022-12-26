import { clickhouseClient, dateToClickhouseDateTime } from '../util/Clickhouse';
import { IQueryValue } from '../cronjobs/crawler/query';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { Logger } from '../util/Logger';
import { S3 } from '../util/S3';

export interface IFileContents {
	servers: IQueryValue[];
}

/**
 * Returns the timestamp of the last imported ping run.
 */
export async function getLastExport(): Promise<Date> {
	try {
		const rows = await clickhouseClient.query({
			query: `SELECT max(pingedAt) as max FROM server_stats`,
		}).then(res => res.json()).then((res: any) => res.data);

		if (rows.length) {
			return new Date(rows[0].max);
		}
		throw new Error('no import');
	} catch (e) {
		throw new Error('no import');
	}
}

const getAllFiles = (dirPath, arrayOfFiles = []) => {
	const files = readdirSync(dirPath);

	files.forEach((file) => {
		if (statSync(`${dirPath}/${file}`).isDirectory()) {
			getAllFiles(`${dirPath}/${file}`, arrayOfFiles);
		} else {
			arrayOfFiles.push(join(dirPath, '/', file));
		}
	});

	return arrayOfFiles;
};

/**
 * Get the latest file from S3.
 *
 * @param since Time to look for files after.
 */

export function getFiles(since: Date): Promise<string | undefined> {
	return S3.listFiles('newcrawler/')
		.then(r => {
			return r.map<[Date, string]>(i => {
				const [filename] = i.split('/').reverse();
				const date = new Date(filename.split('.json')[0]);
				date.setMilliseconds(0);

				return [date, i];
			})
			.sort((a, b) => a[0] > b[0] ? 1 : -1);
		})
		.then(res => {
			return res.filter(date => {
				return date[0] > since;
			})
				.map(i => i[1])[0];
		});
}

let lastExport;

const doStuff = (async () => {
	if (!lastExport) {
		lastExport = await getLastExport();
	}

	const latestFile: string = await getFiles(lastExport);
	if (!latestFile) {
		Logger.info('No new import was found');


		process.exit(0);
	}

	// tslint:disable
	const file = latestFile.startsWith('/Users') ? readFileSync(latestFile, 'utf8') : await S3.getFile(latestFile);
	const fileAt = new Date(latestFile.split('/').reverse()[0].split('.json')[0]);
	const payload: IFileContents = JSON.parse(file);


	Logger.info('Parsing batch..', { fileAt  });

	const rows = payload.servers.filter(r => !!r.payload).map(server => ({
		address: server.ip.address,
		port: server.port,
		players: server.payload.online,
		maxPlayers: server.payload.maxplayers,
		ping: server.payload.ping,
		icmpPing: server.ip.ping || -1,
		hosted: server.hosted,
		sacnr: server.sacnr ?? false,
		openMp: server.openmp ?? false,
		city: server.ip.city ?? 'unknown',
		country: server.ip.country ?? 'unknown',
		asnName: server.ip.asn.autonomousSystemOrganization ?? 'unknown',
		asnId: +server.ip.asn.autonomousSystemNumber ?? -1,
		version: server.payload.rules.version ?? 'unknown',
		origin: server.hosted ? 'hosted' : server.sacnr ? 'sacnr' : server.openmp ? 'openmp' : 'sagl',
		hostname: server.payload.hostname,
		gamemode: server.payload.gamemode,
		language: server.payload.language,
		passworded: server.payload.passworded,
		pingedAt: dateToClickhouseDateTime(fileAt),
	}));

	await clickhouseClient.insert({
		values: rows,
		table: 'server_stats',
		format: 'JSONEachRow',
	})

	Logger.info('Writing points', { servers: payload.servers.length });
	Logger.info('Done', { fileAt });

	lastExport = fileAt;
});

(async () => {
	await doStuff();
})()
	.catch((e: Error) => {
		Logger.error('Error occurred with import', e);
	});
