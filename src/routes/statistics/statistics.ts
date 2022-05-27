import { AggregationsStringTermsAggregate } from '@elastic/elasticsearch/lib/api/types';
import { Lifecycle, Server } from '@hapi/hapi';
import config from 'config';

import { elasticsearch } from '../../util/Elasticsearch';
import { RouterFn } from './../../util/Types';

async function aggregate(property: string): Promise<{ key: string; value: number }[]> {
	const results = await elasticsearch.search({
		index: config.get('elasticsearch.index'),
		track_total_hits: false,
		size: 0,
		query: {
			range: {
				lastOnlineAt: {
					gte: 'now-12h/d',
				},
			},
		},
		aggs: {
			keys: { terms: { field: property, size: 10000 } },
		},
	});

	const data = <AggregationsStringTermsAggregate>results.aggregations.keys;

	if (!Array.isArray(data.buckets)) {
		throw new Error('Something went wrong.');
	}

	return data.buckets.map(res => ({ key: res.key, value: res.doc_count }));
}

export const routes: RouterFn = (router: Server): void => {
	router.route({
		method: 'GET',
		path: '/statistics/current/network.asn',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			const results = await elasticsearch.search({
				index: config.get('elasticsearch.index'),
				track_total_hits: false,
				size: 0,
				query: {
					range: {
						lastOnlineAt: {
							gte: 'now-12h/d',
						},
					},
				},
				aggs: {
					keys: { multi_terms: <any>{ terms: [{ field: 'asnId' }, { field: 'asnName.keyword' }], size: 10000 } }, //tslint:disable-line no-any
				},
			});

			const data = <AggregationsStringTermsAggregate>results.aggregations.keys;

			if (!Array.isArray(data.buckets)) {
				throw new Error('Something went wrong.');
			}

			return data.buckets.map(res => ({ asn: res.key[0], name: res.key[1], count: res.doc_count }));
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/network.country',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			return aggregate('country.keyword')
				.then(res => res.map(({ key, value }) => ({ country: key, count: value })));

		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/game.language',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			return aggregate('language.keyword')
				.then(res => res.map(({ key, value }) => ({ language: key, count: value })));
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/game.gamemode',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			return aggregate('gamemode.keyword')
				.then(res => res.map(({ key, value }) => ({ gamemode: key, count: value })));
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/game.version',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			return aggregate('rules.version.keyword')
				.then(res => res.map(({ key, value }) => ({ version: key, count: value })));
		},
	});

	router.route({
		method: 'GET',
		path: '/statistics/current/players',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			return elasticsearch.sql.query({
				query: `SELECT SUM(maxPlayers), SUM(onlinePlayers), AVG(onlinePlayers) FROM "${config.get('elasticsearch.index')}" WHERE "online" = true`,
			}).then(r => {
				const [maxPlayers, onlinePlayers, avgPlayers] = r.rows[0];

				return {
					onlinePlayers: onlinePlayers,
					maxPlayers: maxPlayers,
					averagePlayers: avgPlayers,
					globalFullness: onlinePlayers / maxPlayers * 100,
				};
			});
		},
	});
};
