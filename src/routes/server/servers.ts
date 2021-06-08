import { Request, ResponseToolkit, Server } from '@hapi/hapi';
import { get } from 'config';
import * as Joi from 'joi';
import * as jwt from 'jsonwebtoken';
import { default as normalizeUrl } from 'normalize-url';
import { Op } from 'sequelize';
import { URL } from 'url';

import { getLastPing } from '../../util/getLastPing';
import { RouterFn } from '../../util/Types';
import { GameServer } from './../../models/GameServer';
import { GameServerPing } from './../../models/GameServerPing';

const types = {
	gt: Op.gt,
	gte: Op.gte,
	lt: Op.lt,
	lte: Op.lte,
	eq: Op.eq,
};

export function inferSocials(weburl?: string): Map<string, string> {
	const map = new Map<string, string>();

	try {
		const url = normalizeUrl((weburl || '').trim(), { defaultProtocol: 'https:', stripAuthentication: true, sortQueryParameters: true });
		const parsed = new URL(url);
		const path = parsed.pathname.split('/');

		if (parsed.hostname === 'vk.com') {
			map.set('vk', path[1]);
		} else if (parsed.hostname === 'discord.gg') {
			map.set('discord', path[1]);
		} else if (parsed.hostname === 'facebook.com' || parsed.hostname === 'www.facebook.com') {
			map.set('facebook', parsed.pathname);
		} else if (parsed.hostname === 'www.sa-mp.com') {
			// na
		} else {
			map.set('url', url);
		}
	} catch (e) {
		//
	}

	return map;
}

export function fetchSocials(gameServer: GameServer, ping: GameServerPing): { [key: string]: string } {
	const map: Map<string, string> = inferSocials(ping.weburl);

	try {
		const url = normalizeUrl((ping.weburl || '').trim(), { defaultProtocol: 'https:', stripAuthentication: true, sortQueryParameters: true });
		const parsed = new URL(url);
		const path = parsed.pathname.split('/');

		if (parsed.hostname === 'vk.com') {
			map.set('vk', path[1]);
		} else if (parsed.hostname === 'discord.gg') {
			map.set('discord', path[1]);
		} else if (parsed.hostname === 'facebook.com' || parsed.hostname === 'www.facebook.com') {
			map.set('facebook', parsed.pathname);
		} else if (parsed.hostname === 'www.sa-mp.com') {
			// na
		} else {
			map.set('url', url);
		}
	} catch (e) {
		//
	}

	for (const [k, v] of Object.entries(gameServer.userSocials || {})) {
		map.set(k, v);
	}

	const resp = {};

	for (const [k, v] of map.entries()) {
		resp[k] = v;
	}

	return resp;
}

function numericQuery(key: string, value: string) {
	const split = String(value).split(':');

	if (split.length === 2 && types[split[0]]) {
		return {
			[key]: {
				[types[split[0]]]: split[1],
			},
		};
	}

	return {
		[key]: value,
	};
}

export interface IDynamicQuery {
	validation: Joi.Schema | Joi.Schema[];
	model: 'gameServer' | 'gameServerPing';
	order: string[];
	where(param: any): object;
}

const dynamicQueries: { [key: string]: IDynamicQuery } = {
	address: {
		validation: [Joi.array().items(Joi.string()).required(), Joi.string().required()],
		model: 'gameServer',
		order: ['address'],
		where: (addresses: string | string[]) => ({
			[Op.or]: (Array.isArray(addresses) ? addresses : [addresses]).map(address => ({ address })),
		}),
	},
	name: {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'hostname'],
		where: (name: string) => ({
			hostname: { [Op.like]: name },
		}),
	},
	isSupporter: {
		validation: Joi.boolean(),
		model: 'gameServer',
		order: ['supporter'],
		where: (supporter: boolean) => ({
			supporter,
		}),
	},
	isHosted: {
		validation: Joi.boolean(),
		model: 'gameServerPing',
		order: ['ping', 'hosted'],
		where: (hosted: boolean) => ({
			hosted,
		}),
	},
	isPassworded: {
		validation: Joi.boolean(),
		model: 'gameServerPing',
		order: ['ping', 'passworded'],
		where: (passworded: boolean) => ({
			passworded,
		}),
	},
	'players.current': {
		validation: Joi.string().regex(/^((gt|lt|gte|lte|eq):)?[0-9]+$/),
		model: 'gameServerPing',
		order: ['ping', 'onlinePlayers'],
		where: (currentPlayers: number) =>  numericQuery('onlinePlayers', String(currentPlayers)),
	},
	'players.max': {
		validation: Joi.string().regex(/^((gt|lt|gte|lte|eq):)?[0-9]+$/),
		model: 'gameServerPing',
		order: ['ping', 'maxPlayers'],
		where: (maxPlayers: number) =>  numericQuery('maxPlayers', String(maxPlayers)),
	},

	'game.language': {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'language'],
		where: (language: number) => ({ language }),
	},
	'game.gamemode': {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'gamemode'],
		where: (gamemode: number) => ({ gamemode }),
	},
	'game.lagcomp': {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'lagcomp'],
		where: (lagcomp: number) => ({ lagcomp }),
	},
	'game.mapname': {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'mapname'],
		where: (mapname: number) => ({ mapname }),
	},
	'game.version': {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'version'],
		where: (version: number) => ({ version }),
	},
	'game.weather': {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'weather'],
		where: (weather: number) => ({ weather }),
	},
	'game.worldtime': {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'worldtime'],
		where: (worldtime: number) => ({ worldtime }),
	},
	'network.country': {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'country'],
		where: (country: number) => ({ country }),
	},
	'network.asn': {
		validation: Joi.number(),
		model: 'gameServerPing',
		order: ['ping', 'asn'],
		where: (asn: number) => ({ asn }),
	},
	'network.asnName': {
		validation: Joi.string(),
		model: 'gameServerPing',
		order: ['ping', 'asnName'],
		where: (asnName: number) => ({ asnName }),
	},
};

// tslint:disable no-any

function parseWhere(params: { [key: string]: string }): {
	gameServer: { [key: string]: any };
	gameServerPing: { [key: string]: any };
} {
	const where = {
		gameServer: [],
		gameServerPing: [],
	};

	for (const [key, value] of Object.entries(params)) {
		if (dynamicQueries[key]) {
			where[dynamicQueries[key].model].push(dynamicQueries[key].where(value));
		}
	}

	return where;
}

function convertColumn(col: string): any {
	if (dynamicQueries[col]) {
		return dynamicQueries[col].order;
	}

	return ['createdAt'];
}

function parseQuery(payload: { [key: string]: any }, lastPing: Date): any {
	let queryObject = payload;
	let lastPingedAt:  Date = lastPing;
	let offset: number = 0;

	if (payload.after) {
		const parsed = parseCursor(payload.after);

		queryObject = parsed.query;
		offset = parsed.offset;
		lastPingedAt = new Date(parsed.lastPingedAt);
	}

	const [col, direction] = queryObject.order.split(':');
	const column = convertColumn(col);
	const { gameServerPing, gameServer } = parseWhere(queryObject);

	const parsedQuery = {
		limit: queryObject.limit,
		offset,
		include: {
			model: GameServerPing,
			where: {
				[Op.and]: gameServerPing,
				online: true,
				batchPingedAt: lastPingedAt,
			},
		},
		order: [[...column, direction.toUpperCase()], ['id', 'desc']],
		where: {
			[Op.and]: [
				{
					[Op.and]: gameServer,
				},
			],
		},
	};

	return {
		rawQuery: queryObject,
		parsedQuery,
	};
}

function parseCursor(cursor: string): { query: { [key: string]: any }; lastId: string; lastPingedAt: string; offset: number } {
	return <{ query: { [key: string]: any }; lastId: string; lastPingedAt: string; offset: number }>jwt.verify(cursor, 'jwtSAGL');
}

function getCursor(request: any, data: { id: string }[], date: Date, offset: number): string {
	return jwt.sign({
		query: request,
		lastId: data[data.length - 1].id,
		lastPingedAt: date,
		offset,
	}, 'jwtSAGL');
}

export async function transformGameServer(gameServer: GameServer, getRelation = i => i.latestPing) {
	const ping: GameServerPing = getRelation(gameServer);
	const socials = fetchSocials(gameServer, ping);

	return {
		id: gameServer.id,
		address: ping.address,
		name: ping.hostname,
		isSupporter: gameServer.supporter,
		isHosted: ping.hosted,
		isPassworded: ping.passworded,
		players: {
			current: ping.onlinePlayers,
			max: ping.maxPlayers,
			hitSAMPLimit: ping.onlinePlayers >= 100,
			online: ping.players !== undefined ? ping.players : undefined,
		},
		game: {
			language: ping.language,
			gamemode: ping.gamemode,
			lagcomp: ping.lagcomp,
			mapname: ping.mapname,
			version: ping.version,
			weather: ping.weather,
			worldtime: ping.worldtime,
		},
		network: {
			country: ping.country,
			asn: +ping.asn,
			asnName: ping.asnName,
		},
		metadata: {
			icon: gameServer.userIcon ?? gameServer.assumedIcon ?? null,
			socials,
		},
		isOnline: ping.batchPingedAt >= new Date(+new Date() - 1000 * 60 * 30),
		snapshotAt: ping.batchPingedAt,
	};
}

function getValidator() {
	const validation = {};

	for (const [key, value] of Object.entries(dynamicQueries)) {
		validation[key] = value.validation;
	}

	return validation;
}

function getSort() {
	return new RegExp(`(${Object.keys(dynamicQueries).join('|')}|createdAt):(asc|desc)`);
}

export const routes: RouterFn = (router: Server): void => {
	router.route({
		method: 'GET',
		path: '/servers',
		options: {
			validate: {
				query: {
					// All validation queries.
					...getValidator(),

					limit: Joi.number().min(1).max(100).default(50), // Item results
					order: Joi.string().regex(getSort()).default('createdAt:desc'),
					after: Joi.string(), // pagination cursor
				},
			},
		},
		async handler(request: Request, h: ResponseToolkit) {
			const lastPing = await getLastPing();
			const query = parseQuery(<any>request.query, lastPing);

			const results = await GameServer.findAll({
				...query.parsedQuery,
				attributes: ['id', 'supporter', 'createdAt'],
				include: [{
					model: GameServerPing,
					as: 'ping',
					...query.parsedQuery.include,
					attributes: [
						'address', 'hostname', 'gamemode', 'language',
						'passworded', 'onlinePlayers', 'maxPlayers', 'weburl',
						'lagcomp', 'mapname', 'version', 'weather', 'worldtime',
						'asn', 'asnName', 'country', 'hosted', 'batchPingedAt',
					],
				}],
			}).then(i => Promise.all(i.map(j => transformGameServer(j, i => i.ping[0]))));

			const endpoint = `${get('web.publicUrl')}/v1/servers`;

			if (results.length >= 1) {
				return h
					.response(results)
					.header('Link', `<${endpoint}?after=${getCursor(request.query, results, lastPing, results.length + +query.parsedQuery.offset)}>; rel="next"`);
			}

			return results;
		},
	});
};
