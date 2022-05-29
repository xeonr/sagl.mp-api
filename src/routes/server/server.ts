import { notFound } from '@hapi/boom';
import { Lifecycle, Request, Server } from '@hapi/hapi';
import { flux, fluxDuration, fluxExpression } from '@influxdata/influxdb-client';
import config from 'config';
import Joi from 'joi';
import moment, { Moment } from 'moment';
import { Op } from 'sequelize';

import { GameServerHostname } from '../../models/GameServerHostname';
import { elasticsearch } from '../../util/Elasticsearch';
import { influxdb } from '../../util/Influxdb';
import { GameServer } from './../../models/GameServer';
import { RouterFn } from './../../util/Types';
import { transformGameServerEs } from './servers';

const roundTo30Minutes = (date: Moment): Moment => {
	return moment(date)
		.set('minutes', Math.floor(date.minutes() / 30) * 30)
		.set('seconds', 0)
		.set('milliseconds', 0);
};

export const routes: RouterFn = (router: Server): void => {
	router.route({
		method: 'GET',
		path: '/servers/{ipOrHostname}',
		options: {
			validate: {
				params: {
					ipOrHostname: Joi.string().required(),
				},
			},
		},
		handler: async (request: Request): Promise<Lifecycle.ReturnValue> => {
			const hostname = await GameServerHostname.findOne({
				where: {
					[Op.or]: [
						{ name: request.params.ipOrHostname },
						{ address: request.params.ipOrHostname },
					],
					verificationExpiredAt: null,
				},
			});
			const gameServer = await GameServer.findOne({ where: { address: hostname?.address ?? request.params.ipOrHostname }});

			if (!gameServer) {
				throw notFound('Game server not tracked');
			}

			const result = await elasticsearch.search({
				size: 1,
				query: {
					match: {
						_id: `${gameServer.ip}:${gameServer.port}`,
					},
				},
			});

			if (result.hits.hits.length < 1) {
				throw notFound('Game server not tracked');
			}

			return transformGameServerEs(result.hits.hits[0], gameServer, hostname ? hostname.name : gameServer.address);
		},
	});

	router.route({
		method: 'GET',
		path: '/servers/{ip}:{port}/tsdb/players',
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
			const resolution = fluxDuration(request.query.period === 'week' ? '2h' : '30m');
			const fn = fluxExpression(request.query.type === 'peak' ? 'max' : request.query.type === 'average' ? 'mean' : 'min');
			const address = `${request.params.ip}:${request.params.port}`;

			const fluxQuery = flux`
				from(bucket: ${config.get('influxdb.bucket')})
				|> range(start: time(v: ${date.toISOString()}), stop: now())
				|> filter(fn: (r) => r["_measurement"] == "server" and r["_field"] == "players" and r["address"] == ${address})
				|> aggregateWindow(every: ${resolution}, fn: ${fn}, createEmpty: true)
			`;

			return new Promise((resolve, reject) => {
				const rows: [string, number][] = [];

				influxdb.getQueryApi(config.get('influxdb.org')).queryRows(fluxQuery, {
					next(row: string[], consumer) {
						const data = consumer.toObject(row);
						rows.push([data._time, data._value]);
					},
					error(err) {
						reject(err);
					},
					complete() {
						resolve(rows);
					},
				});
			});
		},
	});

	router.route({
		method: 'GET',
		path: '/servers/{ip}:{port}/tsdb/ping',
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
			const resolution = fluxDuration(request.query.period === 'week' ? '2h' : '30m');
			const address = `${request.params.ip}:${request.params.port}`;

			const fluxQuery = flux`
				from(bucket: ${config.get('influxdb.bucket')})
				|> range(start: time(v: ${date.toISOString()}), stop: now())
				|> filter(fn: (r) => r["_measurement"] == "server" and r["_field"] == "ping" and r["address"] == ${address})
				|> aggregateWindow(every: ${resolution}, fn: avg, createEmpty: true)
			`;

			return new Promise((resolve, reject) => {
				const rows: [string, number][] = [];

				influxdb.getQueryApi(config.get('influxdb.org')).queryRows(fluxQuery, {
					next(row: string[], consumer) {
						const data = consumer.toObject(row);
						rows.push([data._time, Math.round(data._value)]);
					},
					error(err) {
						reject(err);
					},
					complete() {
						resolve(rows);
					},
				});
			});
		},
	});
};
