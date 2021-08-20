import { Lifecycle, Server } from '@hapi/hapi';
import { Sequelize } from 'sequelize-typescript';

import { GameServerPing } from '../../models/GameServerPing';
import { getLastPing } from '../../util/getLastPing';
import { RouterFn } from './../../util/Types';

export const routes: RouterFn = (router: Server): void => {
	router.route({
		method: 'GET',
		path: '/statistics/current/network.asn',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			const lastPing = await getLastPing();

			return GameServerPing.findAll<any>({ // tslint:disable-line no-any
				attributes: [
					'asn',
					[Sequelize.fn('ANY_VALUE', Sequelize.col('asn')), 'asn'],
					[Sequelize.fn('ANY_VALUE', Sequelize.col('asnName')), 'asnName'],
					[Sequelize.fn('COUNT', '*'), 'count'],
				],
				where: {
					batchPingedAt: lastPing,
				},
				order: [[Sequelize.col('count'), 'desc']],
				group: ['asn'],
				raw: true,
			}).then((r:  { asn: number; asnName: string; count: number }[]) => {
				const data: { [key: string]: number } = {};

				r.forEach((i: { asnName: string; count: number }) => {
					if (i.asnName !== null) {
						if (data[i.asnName]) {
							data[i.asnName] += i.count;
						} else {
							data[i.asnName] = i.count;
						}
					}
				});

				return Object.keys(data).map(asnName => ({
					asn: +r.find(i => i.asnName === asnName).asn,
					name: asnName,
					count: data[asnName],
				})).sort((b, a) => a.count - b.count);
			});
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/network.country',
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
			}).then((r: any) => { // tslint:disable-line no-any
				return r.map(host => ({ country: host.country, count: host.count })).sort((b, a) => a.count - b.count);
			});
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/game.language',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			const lastPing = await getLastPing();

			return GameServerPing.findAll({
				attributes: [
					'language',
					[Sequelize.fn('COUNT', '*'), 'count'],
				],
				where: {
					batchPingedAt: lastPing,
				},
				order: [[Sequelize.col('count'), 'desc']],
				group: ['language'],
				raw: true,
			}).then((r: any) => { // tslint:disable-line no-any
				return r.map(host => ({ language: host.language, count: host.count })).sort((b, a) => a.count - b.count);
			});
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/game.gamemode',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			const lastPing = await getLastPing();

			return GameServerPing.findAll({
				attributes: [
					'gamemode',
					[Sequelize.fn('COUNT', '*'), 'count'],
				],
				where: {
					batchPingedAt: lastPing,
				},
				order: [[Sequelize.col('count'), 'desc']],
				group: ['gamemode'],
				raw: true,
			}).then((r: any) => { // tslint:disable-line no-any
				return r.map(host => ({ gamemode: host.gamemode, count: host.count })).sort((b, a) => a.count - b.count);
			});
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/game.version',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			const lastPing = await getLastPing();

			return GameServerPing.findAll({
				attributes: [
					'version',
					[Sequelize.fn('COUNT', '*'), 'count'],
				],
				where: {
					batchPingedAt: lastPing,
				},
				order: [[Sequelize.col('count'), 'desc']],
				group: ['version'],
				raw: true,
			}).then((r: any) => { // tslint:disable-line no-any
				return r.map(host => ({ version: host.version, count: host.count })).sort((b, a) => a.count - b.count);
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
			}).then((r: any) => { // tslint:disable-line no-any
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
