import config from '@majesticfudgie/vault-config';
import IORedis, { Redis } from 'ioredis';

function getRedis(): Redis {
	return new IORedis(config.get('redis'));
}

const client: { pub: Redis } = {
	pub: getRedis(),
};

export const redisPub: Redis = client.pub;
