import '../../util/DB';
import { S3 } from './../../util/S3';
import { Logger } from '../../util/Logger';
import { getQueryableServers, IQueryableServers } from './gather';
import PQueue from 'p-queue';
import { IQueryValue, query } from './query';
import { getFilename } from './store';
import { blacklistServers, storeServers } from './cache';

export async function start() {
	const startAt = new Date();

	Logger.info('Starting crawler run', {
		filename: getFilename(startAt),
	})


	const serverList: IQueryableServers = await getQueryableServers();
	Logger.info('Fetched all servers', {
		total: serverList.servers.size, blacklisted: serverList.blacklisted.size, hosted: serverList.hosted.size
	});

	// Identify the non-blacklisted servers
	const servers = Array.from(serverList.servers).filter(server => !serverList.blacklisted.has(server));

	const queue = new PQueue({ concurrency: 30 });
	const responses: IQueryValue[] = [];
	const failed: string[] = [];

	// Query all available SA:MP servers..
	await queue.addAll<Promise<void>>(servers.map(server => {
		return () => query(server, serverList)
			.then(res => {
				responses.push(res);

				if (!res.payload) {
					failed.push(server);
				}

				Logger.info('Successfully queried for data', {
					address: res.ip.address,
					online: !!res.payload,
				});
			})
			.catch((err: Error) => {
				Logger.info('Failed to query for data', {
					address: server,
					error: err.toString(),
				});

				failed.push(server);
			})
			.then<void>(() => {
				const totalQueried = failed.length + responses.length;

				if (totalQueried % 100 === 0) {
					console.log('Queried', totalQueried, 'out of ', servers.length)
				}

			});
	}));
	await queue.onIdle();

	// Store the results somewhere
	await S3.upload(getFilename(startAt), JSON.stringify({ servers: responses }), 'application/json');

	Logger.info('Completed the crawl run', {
		filename: getFilename(startAt),
		duration: `${+new Date() - +startAt}ms`,
		crawled: responses.length,
		failed: failed.length,
		crawledOnline: responses.filter(res => !!res.payload).length,
	});

	// Store the servers in core db.
	await storeServers(responses);
	await blacklistServers(failed)

	process.exit(0);
}

start()
	.catch(err => {
		console.log(err);

		process.exit(1);
	})
