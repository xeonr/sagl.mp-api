import { Datapoint, GetPingTimeseriesRequest, GetPingTimeseriesResponse, Timeframe } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { clickhouseClient, dateToClickhouseDateTime } from '../../util/Clickhouse';
import { roundTo30Minutes } from '../../util/utils';
import moment from 'moment';
export async function getServerPing(request: GetPingTimeseriesRequest): Promise<GetPingTimeseriesResponse> {
	const fromDate = roundTo30Minutes(moment().subtract(1, request.period === Timeframe.DAY ? 'day' : 'week'));
	const resolution = request.period !== Timeframe.DAY ? '2h' : '30m';
	const interval = resolution === '2h' ? 60 * 60 * 2 : 30 * 60;

	return clickhouseClient.query({
		query_params: {
			port: request.port,
			ip: request.ipAddress,
			interval,
			fromTime: dateToClickhouseDateTime(fromDate.toDate()),
		},
		query: `
SELECT
	min(pingedAt) AS bucket,
	avg(players) AS value,
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
			return new GetPingTimeseriesResponse({
				datapoints: res.data.map((row: any) => new Datapoint({
					timestamp: new Date(row.bucket).toISOString(),
					value: BigInt(Math.round(row.value)),
				})),
			});
		});
}