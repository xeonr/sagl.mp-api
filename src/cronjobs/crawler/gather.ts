import { GameServerBlacklist } from './../../models/GameServerBlacklist';
import { GameServer } from '../../models/GameServer';
import got from 'got';
import { Op } from 'sequelize';
import { Logger } from '../../util/Logger';

/**
 * Get servers from the openmp server list
 */
async function getOpenMP(): Promise<string[]> {
	try {
		return await got.get('https://api.open.mp/server/', { timeout: 5000, responseType: 'json' })
			.then(r => r.body)
			.then((r: any[]) => r.map(i => i.ip)); // tslint:disable-line
	} catch (e) {
		Logger.warn('Unable to fetch openmp', e.message);

		return [];
	}
}

export interface IQueryableServers {
	servers: Set<string>;
	hosted: Set<string>;
	openmp: Set<string>;
	blacklisted: Set<string>;
}

/**
 * Returns all game servers that should be queried.
 */
export async function getQueryableServers(): Promise<IQueryableServers> {
	const [
		servers,
		notViaOpenMP,
		blacklisted,
		internet,
		hosted,
		openmp,
	] = await Promise.all([
		GameServer.findAll({}).then(i => i.map(e => `${e.ip}:${e.port}`))
			.catch(() => []),
		GameServer.findAll({ where: { openmp: false } }).then(i => i.map(e => `${e.ip}:${e.port}`))
			.catch(() => []),
		GameServerBlacklist.findAll({ where: { expiresAt: { [Op.gt]: new Date() } } })
			.then(i => i.map(e => e.address))
			.catch(() => []),
		got.get('http://lists.sa-mp.com/0.3.7/internet')
			.then(res => res.body.trim().split('\n'))
			.catch(() => []),
		got.get('http://lists.sa-mp.com/0.3.7/hosted')
			.then(res => res.body.trim().split('\n'))
			.catch(() => []),
		getOpenMP()
			.catch(() => []),
	])

	return {
		servers: new Set([...servers, ...internet, ...hosted, ...openmp]),
		hosted: new Set([...hosted]),

		// Only attribute openmp servers when they didn't originate from us.
		openmp: new Set([...openmp.filter(i => !internet.includes(i) && !hosted.includes(i) && !notViaOpenMP.includes(i))]),

		blacklisted: new Set([...blacklisted]),
	};
}
