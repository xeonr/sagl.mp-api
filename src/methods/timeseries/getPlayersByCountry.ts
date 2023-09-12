import { Datapoint, GetPlayersByCountryRequest, GetPlayersByCountyResponse, GetPlayersByCountyResponse_CountryTimeseries } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import moment from 'moment';
import { clickhouseClient, dateToClickhouseDateTime } from '../../util/Clickhouse';
import lodash from 'lodash';

export async function getPlayersByCountry(_: GetPlayersByCountryRequest): Promise<GetPlayersByCountyResponse> {
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
	return clickhouseClient.query({ query, query_params: { date: dateToClickhouseDateTime(from) } })
		.then(res => res.json())
		.then((res: any) => res.data)
		.then(res => {
			const data = lodash.groupBy(res, r => r['country']);
			const times = Object.keys(data);

			return new GetPlayersByCountyResponse({
				countries: times.map(time => new GetPlayersByCountyResponse_CountryTimeseries({
					country: time,
					datapoints: data[time].map(e => new Datapoint({
						value: BigInt(Math.round(e.value)),
						timestamp: new Date(e.timestamp).toISOString(),
					})),
				})),
			});
		});
}
