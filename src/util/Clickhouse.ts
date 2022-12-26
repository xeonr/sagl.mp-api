import { createClient } from '@clickhouse/client'
import configInstance from '@majesticfudgie/vault-config';

export const clickhouseClient = createClient({
	host: configInstance.get('clickhouse.host'),
	username: configInstance.get('clickhouse.username'),
	password: configInstance.get('clickhouse.password'),
	database: configInstance.get('clickhouse.database'),
	clickhouse_settings: {}
});



export function dateToClickhouseDateTime(date): string {
	const pad = (n) => n < 10 ? `0${n}` : n;

	const year = Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'UTC' }).format(date);
	const month = Intl.DateTimeFormat('en-GB', { month: '2-digit', timeZone: 'UTC' }).format(date);
	const day = Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'UTC' }).format(date);
	const hr = Intl.DateTimeFormat('en-GB', { hour: 'numeric', timeZone: 'UTC', }).format(date);
	const min = pad(Intl.DateTimeFormat('en-GB', { minute: 'numeric', timeZone: 'UTC' }).format(date));
	const sec = pad(Intl.DateTimeFormat('en-GB', { second: 'numeric', timeZone: 'UTC', }).format(date));

	return `${year}-${month}-${day} ${hr}:${min}:${sec}`;
}
