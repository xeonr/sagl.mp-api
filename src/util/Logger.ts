import { omit } from 'lodash';
import { createLogger, format, transports } from 'winston';

// tslint:disable
const color = require('json-colorizer');

const logger = createLogger({
	level: 'info',
	format: format.json(),
	defaultMeta: { service: 'server-api' },
});

if (process.env.NODE_ENV !== 'production') {
	let date = new Date().toISOString();
	const logFormat = format.printf((info): string => {
		return `${date}-${info.level}: ${info.message} ${color(JSON.stringify(omit(info, ['level', 'message']), null, 4))}\n`;
	});

	logger.add(new transports.Console({
		format: format.combine(format.colorize(), logFormat),
	}));
}

export const Logger = logger;
