import { get } from 'config';
import IORedis, { Redis } from 'ioredis';

function getRedis(): Redis {
	return new IORedis(get('redis'));
}

const client: { pub: Redis } = {
	pub: getRedis(),
};

export const redisPub: Redis = client.pub;
