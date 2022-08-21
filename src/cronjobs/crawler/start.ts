// require('elastic-apm-node').start({ });

import { gateway } from './../../util/metrics';
import apm from 'elastic-apm-node';
import '../../util/DB';
import { Logger } from '../../util/Logger';
import { getQueryableServers, IQueryableServers } from './gather';
import PQueue from 'p-queue';
import { IQueryValue, query } from './query';
import { getFilename } from './store';
import { getCounter, getGauge } from '../../util/metrics';

const job = getGauge('job', ['type']);
const runtime = getGauge('runtime', ['status']);

const startAt = new Date();

export async function start() {
	job.set({ type: 'start' }, +new Date());

	Logger.info('Starting crawler run', {
		filename: getFilename(startAt),
	})


	const serverList: IQueryableServers = await getQueryableServers();
	Logger.info('Fetched all servers', {
		total: serverList.servers.size, blacklisted: serverList.blacklisted.size, hosted: serverList.hosted.size
	});

	// Identify the non-blacklisted servers
	const servers = Array.from(serverList.servers).filter(server => !serverList.blacklisted.has(server));

	const loadedGauge = getGauge('servers_loaded', ['source'])
	loadedGauge.set({ source: 'hosted' }, serverList.hosted.size)
	loadedGauge.set({ source: 'blacklist' }, serverList.blacklisted.size)
	loadedGauge.set({ source: 'openmp' }, serverList.openmp.size)
	loadedGauge.set({ source: 'known' }, serverList.servers.size)
	loadedGauge.set({ source: 'queryable' }, servers.length)

	const queue = new PQueue({ concurrency: 30 });
	const responses: IQueryValue[] = [];
	const failed: string[] = [];

	const queried = getCounter('servers_queried', ['status'])
	// Query all available SA:MP servers..
	await queue.addAll<Promise<void>>(servers.map(server => {
		return () => query(server, serverList)
			.then(res => {
				responses.push(res);

				if (!res.payload) {
					failed.push(server);
					queried.inc({ status: 'failed' }, 1);
				}

				Logger.info('Successfully queried for data', {
					address: res.ip.address,
					online: !!res.payload,
				});
				queried.inc({ status: 'success' }, 1);
			})
			.catch((err: Error) => {
				Logger.info('Failed to query for data', {
					address: server,
					error: err.toString(),
				});

				failed.push(server);

				queried.inc({ status: 'exception' }, 1);
			})
			.then<void>(() => {
				const totalQueried = failed.length + responses.length;

				if (totalQueried % 50 === 0) {
					Logger.info(`Queried ${totalQueried} servers out of ${servers.length}`)
				}

			});
	}));
	await queue.onIdle();

	// Store the results somewhere
	// await S3.upload(getFilename(startAt), JSON.stringify({ servers: responses }), 'application/json');

	Logger.info('Completed the crawl run', {
		filename: getFilename(startAt),
		duration: `${+new Date() - +startAt}ms`,
		crawled: responses.length,
		failed: failed.length,
		crawledOnline: responses.filter(res => !!res.payload).length,
	});

	// Store the servers in core db.
	// await storeServers(responses);
	// await blacklistServers(failed)

	runtime.set({ status: 'success' }, +new Date() - +startAt)
	job.set({ type: 'end' }, +new Date());

	return true;
}

Promise.resolve()
	.then(() => {
		const trans = apm.startTransaction('crawler', 'job')

		return start()
			.catch(err => {
				runtime.set({ status: 'failed' }, +new Date() - +startAt)

				return false;
			})
			.then(async (success) => {
				await gateway.pushAdd({ jobName: 'sagl-crawler' });
				trans.result = success ? 'success' : 'error';

				try {
					await apm.flush();
				} catch(e) {
					Logger.warn('Unable to flush apm', e);
				} finally {
					process.exit(success ? 0 : 1);
				}
			})
	})
