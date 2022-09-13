import { GameServerBlacklist } from './../../models/GameServerBlacklist';
import { GameServer } from './../../models/GameServer';
import { IQueryValue } from './query';

export async function storeServers(results: IQueryValue[]): Promise<void> {
	// Cache any new hosts we found along the way.
	const hosts = results.map(i => ({
		address: i.hostname,
		ip: i.ip.address,
		port: i.port,
		sacnr: i.sacnr,
		openmp: i.openmp,
	}));

	await GameServer.bulkCreate(hosts, {
		ignoreDuplicates: true,
	});
}

export async function blacklistServers(servers: string[]) {
	const offset = Math.round(Math.random() * (1000 * 60 * 60 * 3));

	for (const server of servers) {
		await GameServerBlacklist.create({
			address: server,
			expiresAt: new Date(+new Date() + (1000 * 60 * 60 * 3) + offset)
		})
		.catch(() => {
			// hmm
		});
	}
}
