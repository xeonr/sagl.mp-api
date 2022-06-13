import {  Client } from '@elastic/elasticsearch';
import config from '@majesticfudgie/vault-config';

export const elasticsearch = new Client({
	node: config.get('elasticsearch.url'),
	auth: {
		username: config.get('elasticsearch.username'),
		password: config.get('elasticsearch.password'),
	},
	tls: {
		rejectUnauthorized: false,
	},
});
