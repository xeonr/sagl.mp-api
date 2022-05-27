import { SearchRequest } from '@elastic/elasticsearch/lib/api/types';
import { Request, ResponseToolkit, Server } from '@hapi/hapi';
import config from 'config';
import * as Joi from 'joi';
import * as jwt from 'jsonwebtoken';
import { default as normalizeUrl } from 'normalize-url';
import { Op } from 'sequelize';
import { URL } from 'url';

import { elasticsearch } from '../../util/Elasticsearch';
import { RouterFn } from '../../util/Types';
import { GameServer } from './../../models/GameServer';

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

export function fetchSocials(gameServer: GameServer, weburl: string): { [key: string]: string } {
	const map: Map<string, string> = inferSocials(weburl);

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

	for (const [k, v] of Object.entries(gameServer.userSocials || {})) {
		map.set(k, v);
	}

	if (gameServer.userDiscordInvite) {
		map.set('discord', gameServer.userDiscordInvite);
	}

	const resp = {};

	for (const [k, v] of map.entries()) {
		resp[k] = v;
	}

	return resp;
}

function numericQuery(key: string, value: string) {
	const split = String(value).split(':');

	const types = ['gt', 'gte', 'lt', 'lte', 'eq', 'bt'];

	if (split.length === 2 && types.includes(split[0])) {
		if (split[0] === 'eq') {
			return { term: { [key]: value }};
		}

		if (split[0] === 'bt') {
			const [from, to] = split[1].split('-');

			return { range: { [key]: { gte: from, lte: to } } };
		}

		return {
			range: {
				[key]: {
					[split[0]]: split[1].split('-')[0],
				},
			},
		};
	}

	return { term: { [key]: value }};
}

export interface IDynamicQuery {
	validation: Joi.Schema | Joi.Schema[];
	order: string;
	type?: 'es' | 'sql';
	where(param: any): object;
}

const dynamicQueries: { [key: string]: IDynamicQuery } = {
	query: {
		validation: Joi.string(),
		order: '_score',
		where: (query: string) => ({
			multi_match: {
				query,
				fields: ['hostname', 'address', 'gamemode'],
				type: 'phrase',
			},
		}),
	},

	address: {
		validation: [Joi.array().items(Joi.string()).required(), Joi.string().required()],
		order: '_id',
		where: (addresses: string | string[]) => ({
			terms: { _id: (Array.isArray(addresses) ? addresses : [addresses]) },
		}),
	},
	name: {
		validation: Joi.string(),
		order: 'hostname',
		where: (name: string) => ({
			match: { hostname: name },
		}),
	},
	isSupporter: {
		validation: Joi.boolean(),
		order: 'supporter',
		type: 'sql',
		where: (supporter: boolean) => ({
			supporter,
		}),
	},
	isHosted: {
		validation: Joi.boolean(),
		order: 'hosted',
		where: (hosted: boolean) => ({
			term: { hosted },
		}),
	},
	isPassworded: {
		validation: Joi.boolean(),
		order: 'passworded',
		where: (passworded: boolean) => ({
			term: { passworded },
		}),
	},
	'players.current': {
		validation: Joi.string().regex(/^((gt|lt|gte|lte|eq|bt):)?[0-9]+(-[0-9]+)?$/),
		order: 'onlinePlayers',
		where: (currentPlayers: number) =>  numericQuery('onlinePlayers', String(currentPlayers)),
	},
	'players.max': {
		validation: Joi.string().regex(/^((gt|lt|gte|lte|eq|bt):)?[0-9]+(-[0-9]+)?$/),
		order: 'maxPlayers',
		where: (maxPlayers: number) =>  numericQuery('maxPlayers', String(maxPlayers)),
	},

	'game.language': {
		validation: Joi.string(),
		order: 'rules.language.keyword',
		where: (language: number) => ({ term: { 'language.keyword': language } }),
	},
	'game.gamemode': {
		validation: Joi.string(),
		order: 'rules.gamemode.keyword',
		where: (gamemode: number) => ({ term: { 'gamemode.keyword': gamemode } }),
	},
	'game.lagcomp': {
		validation: Joi.string(),
		order: 'rules.lagcomp',
		where: (lagcomp: number) => ({ term: { 'rules.lagcomp': lagcomp } }),
	},
	'game.mapname': {
		validation: Joi.string(),
		order: 'rules.mapname.keyword',
		where: (mapname: number) => ({ term: { 'rules.mapname.keyword': mapname } }),
	},
	'game.version': {
		validation: Joi.string(),
		order: 'rules.version.keyword',
		where: (version: number) => ({ term: { 'rules.version.keyword': version } }),
	},
	'game.weather': {
		validation: Joi.string(),
		order: 'rules.weather.keyword',
		where: (weather: number) => ({ term: { 'rules.weather.keyword': weather } }),
	},
	'game.worldtime': {
		validation: Joi.string(),
		order: 'rules.worldtime.keyword',
		where: (worldtime: number) => ({ term: { 'rules.worldtime.keyword': worldtime } }),
	},
	'network.country': {
		validation: Joi.string(),
		order: 'country.keyword',
		where: (country: number) => ({ term: { 'country.keyword': country } }),
	},
	'network.asn': {
		validation: Joi.number(),
		order: 'asnId',
		where: (asn: number) => ({ term: { asnId: asn } }),
	},
	'network.asnName': {
		validation: Joi.string(),
		order: 'asnName.keyword',
		where: (asnName: number) => ({ term: { 'asnName.keyword': asnName  } }),
	},
	'metadata.discordGuild': {
		type: 'sql',
		validation: [Joi.array().items(Joi.string()).required(), Joi.string().required()],
		order: 'discordGuild',
		where: (guild: number) => ({
			[Op.or]: [].concat(...(Array.isArray(guild) ? guild : [guild]).map(g => [
				{ userDiscordGuild: g },
				{ assumedDiscordGuild: g },
			])),
		}),
	},
};

// tslint:disable no-any

function parseWhere(params: { [key: string]: string }): any[] {
	const where = [];

	for (const [key, value] of Object.entries(params)) {
		if (dynamicQueries[key] && dynamicQueries[key].type !== 'sql') {
			where.push(dynamicQueries[key].where(value));
		}
	}

	return where;
}

function convertColumn(col: string): any {
	if (dynamicQueries[col]) {
		return dynamicQueries[col].order;
	}

	return ['lastUpdatedAt'];
}

async function querySQL(query) {
	const where = [];

	for (const [key, value] of Object.entries(query)) {
		if (dynamicQueries[key] && dynamicQueries[key].type === 'sql') {
			where.push(dynamicQueries[key].where(value));
		}
	}

	if (where.length === 0) {
		return null;
	}

	const servers = await GameServer.findAll({
		where: { [Op.and]: where },
		attributes: ['address'],
	});

	return servers.map(i => i.address);
}

function parseQuery(payload: { [key: string]: any }, servers: string[] | null): any {
	let queryObject = payload;
	let offset: number = 0;

	if (payload.after) {
		const parsed = parseCursor(payload.after);

		queryObject = parsed.query;
		offset = parsed.offset;
	}

	const [col, direction] = queryObject.order.split(':');
	const column = convertColumn(col);
	const where = parseWhere(queryObject);

	if (servers !== null) {
		where.push({ terms: { _id: servers } });
	}
	const parsedQuery: SearchRequest = {
		size: queryObject.limit,
		from: offset,
		sort: <any>[
			{ [column]: direction.toLowerCase() },
			{ _score: 'desc' },
		],
		query: {
			bool: {
				must: [...where, { exists: { field: 'rules' } }, { range: { lastOnlineAt: { gte: 'now-12h/d' } } }],
			},
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

function getCursor(request: any, data: { id: string }[], offset: number): string {
	return jwt.sign({
		query: request,
		lastId: data[data.length - 1].id,
		offset,
	}, 'jwtSAGL');
}

export async function transformGameServerEs(result: any, passedServer?: GameServer) {
	const { _source: server } = result;
	const gameServer = passedServer ? passedServer : await GameServer.findOne({ where: { address: server.address }});
	const socials = fetchSocials(gameServer, server.rules.weburl);

	return {
		id: 'removed',
		address: server.address,
		name: server.hostname,
		isSupporter: gameServer.supporter,
		isHosted: server.hosted,
		isPassworded: server.passworded,
		players: {
			current: server.onlinePlayers,
			max: server.maxPlayers,
			hitSAMPLimit: server.onlinePlayers >= 100,
			online: server.players !== undefined ? server.players : undefined,
		},
		game: {
			language: server.language ?? null,
			gamemode: server.gamemode ?? null,
			lagcomp: server.rules.lagcomp ?? null,
			mapname: server.rules.mapname ?? null,
			version: server.rules.version ?? null,
			weather: server.rules.weather ?? null,
			worldtime: server.rules.worldtime ?? null,
		},
		network: {
			country: server.country,
			asn: server.asnId,
			asnName: server.asnName,
		},
		metadata: {
			icon: gameServer.userIcon ?? gameServer.assumedIcon ?? null,
			discordGuild: gameServer.userDiscordGuild ?? gameServer.assumedDiscordGuild ?? null,
			socials,
		},
		isOnline: new Date(server.lastOnlineAt) >= new Date(+new Date() - 1000 * 60 * 30),
		lastOnlineAt: server.lastOnlineAt,
		snapshotAt: server.lastUpdatedAt,
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
			const addresses = await querySQL(request.query);
			const query = parseQuery(<any>request.query, addresses);
			console.log(JSON.stringify(query.parsedQuery, null, 4));
			const results = await elasticsearch.search(query.parsedQuery)
				.then(async i => {
					const servers = await GameServer.findAll({ where: { address: i.hits.hits.map(r => r._id)}});

					return Promise.all(i.hits.hits.map(res => transformGameServerEs(res, servers.find(r => r.address === res._id))));
				});

			const endpoint = `${config.get('web.publicUrl')}/v1/servers`;

			if (results.length >= 1) {
				return h
					.response(results)
					.header('Link', `<${endpoint}?after=${getCursor(request.query, results, results.length + +query.parsedQuery.offset)}>; rel="next"`);
			}

			return results;
		},
	});
};
