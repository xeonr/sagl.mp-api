import { Lifecycle, Server } from '@hapi/hapi';
import { Sequelize } from 'sequelize-typescript';

import { GameServerPing } from '../../models/GameServerPing';
import { getLastPing } from '../../util/getLastPing';
import { RouterFn } from './../../util/Types';

export const routes: RouterFn = (router: Server): void => {
	router.route({
		method: 'GET',
		path: '/statistics/current/host',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			const lastPing = await getLastPing();

			return GameServerPing.findAll({
				attributes: [
					'asn',
					[Sequelize.fn('ANY_VALUE', Sequelize.col('asnName')), 'asnName'],
					[Sequelize.fn('COUNT', '*'), 'count'],
				],
				where: {
					batchPingedAt: lastPing,
				},
				order: [[Sequelize.col('count'), 'desc']],
				group: ['asn'],
				raw: true,
			}).then(r => {
				const data: { [key: string]: number } = {};

				r.forEach((i: any) => {
					if (i.asn === null || i.count <= 2) {
						if (data.Other) {
							data.Other += i.count;
						} else {
							data.Other = i.count;
						}
					} else {
						if (data[i.asnName]) {
							data[i.asnName] += i.count;
						} else {
							data[i.asnName] = i.count;
						}
					}
				});

				return Object.keys(data).map(host => ({ host, count: data[host] })).sort((b, a) => a.count - b.count);
			});
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/country',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			const lastPing = await getLastPing();

			return GameServerPing.findAll({
				attributes: [
					'country',
					[Sequelize.fn('COUNT', '*'), 'count'],
				],
				where: {
					batchPingedAt: lastPing,
				},
				order: [[Sequelize.col('count'), 'desc']],
				group: ['country'],
				raw: true,
			}).then((r: any) => {
				return r.map(host => ({ country: host.country, count: host.count })).sort((b, a) => a.count - b.count);
			});
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/players',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			const lastPing = await getLastPing();

			return GameServerPing.findAll({
				attributes: [
					[Sequelize.fn('SUM', Sequelize.col(`maxPlayers`)), 'maxPlayers'],
					[Sequelize.fn('SUM', Sequelize.col(`onlinePlayers`)), 'onlinePlayers'],
					[Sequelize.fn('AVG', Sequelize.col(`onlinePlayers`)), 'averagePlayers'],
				],
				where: {
					online: true,
					batchPingedAt: lastPing,
				},
				raw: true,
			}).then((r: any) => {
				return {
					onlinePlayers: +r[0].onlinePlayers,
					maxPlayers: +r[0].maxPlayers,
					averagePlayers: +r[0].averagePlayers,
					globalFullness: r[0].onlinePlayers / r[0].maxPlayers * 100,
				};
			});
		},
	});
};
