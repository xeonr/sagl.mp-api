import { notFound } from '@hapi/boom';
import { Lifecycle, Request, Server } from '@hapi/hapi';
import config from '@majesticfudgie/vault-config';
import Joi from 'joi';
import moment, { Moment } from 'moment';
import { Op } from 'sequelize';

import { GameServerHostname } from '../../models/GameServerHostname';
import { elasticsearch } from '../../util/Elasticsearch';
import { GameServer } from './../../models/GameServer';
import { RouterFn } from './../../util/Types';
import { transformGameServerEs } from './servers';
import { clickhouseClient, dateToClickhouseDateTime } from '../../util/Clickhouse';

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
			let ipOrHostname = request.params.ipOrHostname;
			const [host, port] = ipOrHostname.split(':');

			if (!port) {
				ipOrHostname = `${host}:7777`;
			}

			const hostname = await GameServerHostname.findOne({
				where: {
					[Op.or]: [
						{ name: ipOrHostname },
						{ address: ipOrHostname },
					],
					verificationExpiredAt: null,
				},
			});
			const gameServer = await GameServer.findOne({ where: { address: hostname?.address ?? ipOrHostname }});

			if (!gameServer) {
				throw notFound('Game server not tracked');
			}

			const result = await elasticsearch.get({
				id: `${gameServer.ip}:${gameServer.port}`,
				index: config.get('elasticsearch.index'),

			});

			if (!result.found) {
				throw notFound('Game server not tracked');
			}

			return transformGameServerEs(result, gameServer, hostname ? hostname.name : gameServer.address);
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
			const fromDate = roundTo30Minutes(moment().subtract(1, request.query.period));
			const resolution = request.query.period !== 'day' ? '2h' : '30m';
			const interval = resolution === '2h' ? 60 * 60 * 2 : 30 * 60;
			const fn = request.query.type === 'peak' ? 'max' : request.query.type === 'average' ? 'avg' : 'min';

			return clickhouseClient.query({
				query_params: {
					port: request.params.port,
					ip: request.params.ip,
					interval,
					fromTime: dateToClickhouseDateTime(fromDate),
				},
				query: `
SELECT
	min(pingedAt) AS bucket,
	${fn}(players) AS value,
	toUnixTimestamp (pingedAt)
	DIV({ interval: Int32 }) AS time
FROM
	server_stats
WHERE
	address = { ip: String }
	AND port = { port: Int32 }
	AND pingedAt >= { fromTime: DateTime }
GROUP BY
	time
ORDER BY
	bucket
`
			}).then(res => res.json())
				.then((res: any) => {
					return res.data.map((row: any) => ([new Date(row.bucket).toISOString(), Math.round(row.value)]));
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
			const fromDate = roundTo30Minutes(moment().subtract(1, request.query.period));
			const resolution = request.query.period !== 'day' ? '2h' : '30m';
			const interval = resolution === '2h' ? 60 * 60 * 2 : 30 * 60;
			const fn = 'avg';

			return clickhouseClient.query({
				query_params: {
					port: request.params.port,
					ip: request.params.ip,
					interval,
					fromTime: dateToClickhouseDateTime(fromDate),
				},
				query: `
SELECT
	min(pingedAt) AS bucket,
	${fn}(ping) AS value,
	toUnixTimestamp (pingedAt)
	DIV({ interval: Int32 }) AS time
FROM
	server_stats
WHERE
	address = { ip: String }
	AND port = { port: Int32 }
	AND pingedAt >= { fromTime: DateTime }
GROUP BY
	time
ORDER BY
	bucket
`
			}).then(res => res.json())
			.then((res: any) => {
				return res.data.map((row: any) => ([new Date(row.bucket).toISOString(), Math.round(row.value)]));
			});
		},
	});
};
