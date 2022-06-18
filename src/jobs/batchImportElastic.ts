import config from '@majesticfudgie/vault-config';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

import { elasticsearch } from '../util/Elasticsearch';
import { Logger } from '../util/Logger';
import { S3 } from '../util/S3';
import { IFileContents } from './batchPing';

/**
 * Returns the timestamp of the last imported ping run.
 */
export async function getLastExport(): Promise<Date> {
	try {
		const { rows } = await elasticsearch.sql.query({
			query: `SELECT max(lastUpdatedAt) as max FROM "${config.get('elasticsearch.index')}"`,
		});

		if (rows.length) {
			return new Date(rows[0][0]);
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

// function listFilesFromFs() {
// 	return getAllFiles('/Users/Luke/Development/sagl-poll-2');
// }

// const files = listFilesFromFs().map<[Date, string]>(i => {
// 	const [filename] = i.split('/').reverse();
// 	const date = new Date(filename.split('.json')[0]);

// 	return [date, i];
// })
// 	.sort((a, b) => a[0] > b[0] ? 1 : -1);

/**
 * Get the latest file from S3.
 *
 * @param since Time to look for files after.
 */
export function getFiles(since: Date): Promise<string | undefined> {
	return S3.listFiles('polls-v2/')
		.then(r => {
			return r.map<[Date, string]>(i => {
				const [filename] = i.split('/').reverse();
				const date = new Date(filename.split('.json')[0]);

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


	Logger.info('Parsing batch..', { fileAt });

	await elasticsearch.bulk({
		operations: [].concat(...payload.servers.map(i => {
			return [
				{ create: { _id: i.hostname, _index: config.get('elasticsearch.index') } },
				{ firstSeenAt: fileAt, lastOnlineAt: new Date(0), lastUpdatedAt: new Date(0) },
			];
		})),
	});

	const r = await elasticsearch.bulk({
		operations: [].concat(...payload.servers.map(server => {
			const globalOptions = {
				address: server.hostname,
				hosted: server.hosted,
				sacnr: server.sacnr ?? false,
				openmp: server.openmp ?? false,
				ip: server.ip.address,
				ipLocation: server.ip.latitude === null || server.ip.longitude === null? {
					latitude: server.ip.latitude,
					longitude: server.ip.longitude,
				} : null,
				port: server.port,
				city: server.ip.city ?? 'unknown',
				country: server.ip.country ?? 'unknown',
				asnName: server.ip.asn.autonomousSystemOrganization ?? 'unknown',
				asnId: server.ip.asn.autonomousSystemNumber ?? 'unknown',
				origin: server.hosted ? 'hosted' : server.sacnr ? 'sacnr' : server.openmp ? 'openmp' : 'sagl',
			}

			if (!server.payload) {
				return [
					{
						update: {
							_id: server.hostname,
							_index: config.get('elasticsearch.index'),
						},
					},
					{
						doc: {
							online: false,
							lastUpdatedAt: fileAt,
							...globalOptions,
						},
					}
				];
			}

			const rules = {};

			for (const [k, v] of Object.entries(server.payload.rules)) {
				rules[k] = String(v);
			}

			return [
				{
					update: {
						_id: server.hostname,
						_index: config.get('elasticsearch.index'),
					},
				},
				{
					doc: {
						online: true,
						lastUpdatedAt: fileAt,
						lastOnlineAt: fileAt,

						...globalOptions,

						players: server.payload.players || [],
						hostname: server.payload.hostname,
						gamemode: server.payload.gamemode,
						language: server.payload.language,
						passworded: server.payload.passworded,
						maxPlayers: server.payload.maxplayers,
						onlinePlayers: server.payload.online,
						ping: server.payload.ping,
						rules: rules,
					},
				}
			];
		})),
	});

	if (r.errors) {
		writeFileSync('elastic.json', JSON.stringify(r, null, 4), 'utf-8');
		console.warn(`Import had errors`);
		writeFileSync('import-aborted.txt', 'true');
		process.exit(1);
	}
	Logger.info('Writing points', { servers: payload.servers.length });
	Logger.info('Done', { fileAt });

	lastExport = fileAt;
});

(async () => {
	if (existsSync('import-aborted.txt')) {
		Logger.warn('Blocked from import to es.');
		return;
	}

	await doStuff();
})()
	.catch((e: Error) => {
		Logger.error('Error occurred with import', e);
	});
