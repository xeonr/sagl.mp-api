import { InfluxDB } from '@influxdata/influxdb-client';
import config from 'config';

export const influxdb = new InfluxDB({
	url: config.get('influxdb.url'),
	token: config.get('influxdb.token'),
});

export function getWriter() {
	return influxdb.getWriteApi(config.get('influxdb.org'), config.get('influxdb.bucket'), 's');
}
