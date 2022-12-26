import { AggregationsStringTermsAggregate } from '@elastic/elasticsearch/lib/api/types';
import { Lifecycle, Server, Request } from '@hapi/hapi';
import config from '@majesticfudgie/vault-config';
import { LocationRecord } from '@maxmind/geoip2-node';

import { elasticsearch } from '../../util/Elasticsearch';
import { lookupIP } from '../../util/MaxMind';
import { RouterFn } from './../../util/Types';
import { groupBy } from 'lodash';
import { clickhouseClient, dateToClickhouseDateTime } from '../../util/Clickhouse';
import moment from 'moment';

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
		path: '/statistics/geo',
		handler: async (request: Request): Promise<Lifecycle.ReturnValue> => {
			let city = null;

			try {
				const geoip = request.headers['x-geo-ip'] ?? request.headers['cf-connecting-ip'] ?? request.info.remoteAddress;

				city = lookupIP(geoip)?.city;
			} catch (e) {
				console.log(e);
				//
			}

			const results = await elasticsearch.search({
				index: config.get('elasticsearch.index'),
				"query": {
					"bool": {
						"must": [
							{ "range": { "lastOnlineAt": { "gte": "now-12h/d" } } },
							{
								"exists": {
									"field": "rules"
								}
							},
							{
								"exists": {
									"field": "ipLocation"
								}
							}
						]
					}
				},
				"sort": [
					{
						"_geo_distance": {
							"ipLocation": {
								"lat": (<LocationRecord>city?.location) ? (<LocationRecord>city?.location).latitude : 0,
								"lon": (<LocationRecord>city?.location) ? (<LocationRecord>city?.location).longitude : 0,
							},
							"order": "asc",
							"unit": "mi"
						}
					},
				] as any,
				"fields": [
					"hostname",
					"ipLocation",
					"onlinePlayers",
					"maxPlayers",
					"country"
				],
				"_source": false,
				"size": 2000
			});

			return {
				current: [(<LocationRecord>city?.location) ? (<LocationRecord>city?.location).latitude : 0, (<LocationRecord>city?.location) ? (<LocationRecord>city?.location).longitude : 0],
				servers: results.hits.hits.map(hit => ({
					id: hit._id,
					hostname: hit.fields['hostname'][0],
					onlinePlayers: hit.fields['onlinePlayers'][0],
					maxPlayers: hit.fields['maxPlayers'][0],
					country: hit.fields['country'][0],
					location: hit.fields['ipLocation'][0].coordinates.reverse(),
					distance: hit.sort[0],
				}))
			};
		},
	});

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


	router.route({
		method: 'GET',
		path: '/statistics/tsdb/players',
		handler: async (): Promise<Lifecycle.ReturnValue> => {
			const from = moment().subtract(1, 'week').startOf('day').toDate();
			const query = `
SELECT
	avg(players) AS value,
	min(pingedAt) as timestamp,
	country,
	toDate (pingedAt) AS date,
	toHour (pingedAt) AS hour
FROM
	server_stats
WHERE pingedAt >= { date: DateTime }
GROUP BY
	country,
	date,
	hour
ORDER BY
	country asc, timestamp asc
`;
			return clickhouseClient.query({ query, query_params: { date: dateToClickhouseDateTime(from)  } })
				.then(res => res.json())
				.then((res: any) => res.data)
				.then(res => {
					const data = groupBy(res, r => r['country']);
					const times = Object.keys(data);

					return times.map(time => ({
						country: time,
						points: data[time].map(e => ({
							value: e.value,
							ts: new Date(e.timestamp).toISOString(),
						}))
					}));
				});
		},
	});
};
