import { Counter, Gauge, Histogram, Pushgateway, Registry } from 'prom-client';
import config from '@majesticfudgie/vault-config';

const PREFIX = 'sagl_servers';
const metrics: any = {};


export const register = new Registry();


export function getCounter<T extends string>(name: string, labels = []): Counter<T> {
	if (!metrics[name]) {
		metrics[name] = new Counter({
			name: `${PREFIX}:${name}`,
			help: `${PREFIX}:${name}_help`,
			registers: [register],
			labelNames: labels,
		});
	}

	return metrics[name];
}

export function getGauge<T extends string>(name: string, labels = []): Gauge<T> {
	if (!metrics[name]) {
		metrics[name] = new Gauge({
			name: `${PREFIX}:${name}`,
			help: `${PREFIX}:${name}_help`,
			registers: [register],
			labelNames: labels,
		});
	}

	return metrics[name];
}

export function getHistogram<T extends string>(name: string, labels = []): Histogram<T> {
	if (!metrics[name]) {
		metrics[name] = new Histogram({
			name: `${PREFIX}:${name}`,
			help: `${PREFIX}:${name}_help`,
			registers: [register],
			labelNames: labels,
		});
	}

	return metrics[name];
}

export const gateway = new Pushgateway(config.get('prometheus.pushEndpoint'), [], register);
