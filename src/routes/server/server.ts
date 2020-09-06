import { notFound } from '@hapi/boom';
import { Lifecycle, Request, Server } from '@hapi/hapi';
import Joi from 'joi';
import { omit } from 'lodash';

import { GameServerPing } from '../../models/GameServerPing';
import { RouterFn } from './../../util/Types';

/**
 * Check if a date is within the last 30 mins..
 */
const isConsideredOnline = (date: Date) => {
	return date >= new Date(+new Date() - 1000 * 60 * 30);
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
		handler: async (_: Request): Promise<Lifecycle.ReturnValue> => {
			return [

			];
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
		handler: async (_: Request): Promise<Lifecycle.ReturnValue> => {
			return [

			];
		},
	});
};
