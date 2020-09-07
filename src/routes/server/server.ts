import { notFound } from '@hapi/boom';
import { Lifecycle, Request, Server } from '@hapi/hapi';
import Joi from 'joi';
import { omit } from 'lodash';
import moment, { Moment } from 'moment';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

import { GameServerPing } from '../../models/GameServerPing';
import { RouterFn } from './../../util/Types';

/**
 * Check if a date is within the last 30 mins..
 */
const isConsideredOnline = (date: Date) => {
	return date >= new Date(+new Date() - 1000 * 60 * 30);
};

const roundTo30Minutes = (date: Moment): Moment => {
	return moment(date)
		.set('minutes', Math.floor(date.minutes() / 30) * 30)
		.set('seconds', 0)
		.set('milliseconds', 0);
};

export const routes: RouterFn = (router: Server): void => {
	router.route({
		method: 'GET',
		path: '/server/{ip}:{port}',
		options: {
			validate: {
				params: {
					ip: Joi.string().ip().required(),
					port: Joi.number().port().required(),
				},
			},
		},
		handler: async (request: Request): Promise<Lifecycle.ReturnValue> => {
			return GameServerPing.findOne({
				where: {
					address: request.params.ip,
					port: request.params.port,
				},
				order: [['batchPingedAt', 'desc']],
			}).then(r => {
				if (!r) {
					throw notFound('Game server not tracked');
				}

				return {
					stale: !isConsideredOnline(r.batchPingedAt),
					hasHitPlayerCap: r.onlinePlayers >= 100,
					...omit(r.toJSON(), ['id', 'createdAt', 'updatedAt']),
				};
			});
		},
	});

	router.route({
		method: 'GET',
		path: '/server/{ip}:{port}/tsdb/players',
		options: {
			validate: {
				params: {
					ip: Joi.string().ip().required(),
					port: Joi.number().port().required(),
				},
				query: {
					type: Joi.string().allow('peak', 'average', 'min').default('average'),
					period: Joi.string().allow('day', 'week', 'month').default('day'),
				},
			},
		},
		handler: async (request: Request): Promise<Lifecycle.ReturnValue> => {
			const date = roundTo30Minutes(moment().subtract(1, request.query.period));

			return GameServerPing.findAll({
				where: {
					online: true,
					address: request.params.ip,
					port: request.params.port,
					batchPingedAt: { [Op.gte]: date },
				},
				attributes: [
					[Sequelize.literal(`UNIX_TIMESTAMP(\`batchPingedAt\`) DIV (30* 60)`), 'date'],
					[Sequelize.fn('MIN', Sequelize.col('batchPingedAt')), 'timestamp'],
					[Sequelize.fn('MIN', Sequelize.col('onlinePlayers')), 'peak'],
					[Sequelize.fn('AVG', Sequelize.col('onlinePlayers')), 'average'],
					[Sequelize.fn('MAX', Sequelize.col('onlinePlayers')), 'max'],
				],
				order: [[Sequelize.col('timestamp'), 'asc']],
				group: ['date'],
				raw: true,
			}).then(res => {
				return res.map((i: any) => { // tslint:disable-line
					const ts = roundTo30Minutes(moment(i.timestamp));

					return [ts.toISOString(), +i[request.query.type]];
				});
			});
		},
	});

	router.route({
		method: 'GET',
		path: '/server/{ip}:{port}/tsdb/ping',
		options: {
			validate: {
				params: {
					ip: Joi.string().ip().required(),
					port: Joi.number().port().required(),
				},
				query: {
					period: Joi.string().allow('day', 'week', 'month').default('day'),
				},
			},
		},
		handler: async (request: Request): Promise<Lifecycle.ReturnValue> => {
			const date = roundTo30Minutes(moment().subtract(1, request.query.period));

			return GameServerPing.findAll({
				where: {
					online: true,
					address: request.params.ip,
					port: request.params.port,
					batchPingedAt: { [Op.gte]: date },
				},
				attributes: [
					[Sequelize.literal(`UNIX_TIMESTAMP(\`batchPingedAt\`) DIV (30* 60)`), 'date'],
					[Sequelize.fn('MIN', Sequelize.col('batchPingedAt')), 'timestamp'],
					[Sequelize.fn('AVG', Sequelize.col('ping')), 'ping'],
				],
				order: [[Sequelize.col('timestamp'), 'asc']],
				group: ['date'],
				raw: true,
			}).then(res => {
				return res.map((i: any) => { // tslint:disable-line
					const ts = roundTo30Minutes(moment(i.timestamp));

					return [ts.toISOString(), Math.round(i.ping)];
				});
			});
		},
	});
};
