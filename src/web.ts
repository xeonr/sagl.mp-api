import { Lifecycle, Request, RequestEvent, ResponseToolkit, Server } from '@hapi/hapi';
import config from '@majesticfudgie/vault-config'; // tslint:disable-line
import * as Joi from 'joi';

import * as ServerRoutes from './routes/server/server';
import * as ServersRoutes from './routes/server/servers';
import * as StatisticsRoutes from './routes/statistics/statistics';

import { db } from './util/DB';
import { Logger } from './util/Logger';
import { RouterFn } from './util/Types';

const server: Server = new Server({
	host: config.get('web.host'),
	port: config.get('web.port'),
	routes: {
		cors: {
			headers: ['traceparent', 'tracecontext', 'link'],
			additionalExposedHeaders: ['link'],
		},
		validate: {
			failAction: (_: Request, __: ResponseToolkit, err?: Error): Lifecycle.ReturnValue => {
				throw err;
			},
		},
	},
});

const routes: ((router: Server) => void)[] = [
	ServersRoutes.routes,
	ServerRoutes.routes,
	StatisticsRoutes.routes,
];

(async (): Promise<void> => {
	Logger.info('Hello.', !!db);

	// Point to docs.
	server.route({
		method: 'GET',
		path: '/',
		options: {
			auth: false,
		},
		handler(_: Request, h: ResponseToolkit) {
			return h.redirect('https://sagl.stoplight.io/docs/server-api/reference/server-api.v1.yaml');
		},
	});

	server.validator(Joi);
	server.realm.modifiers.route.prefix = '/v1';

	server.events.on('request', (err: Request, listener: RequestEvent): void => {
		if (listener.error && (<any>listener.error).isServer) { // tslint:disable-line no-any
			// tslint:disable-next-line no-any
			Logger.error(`Error while accessing route ${err.route.path}`, { error: (<any>listener.error)!.stack });
		}
	});

	// Load all routes
	routes.forEach((r: RouterFn): void => { r(server); });

	// Boot server
	await server.start();

	Logger.info('Started server', {
		host: config.get('web.host'),
		port: config.get('web.port'),
		url: `http://${config.get('web.host')}:${config.get('web.port')}`, // tslint:disable-line
	});
})()
	.catch((e: Error): void => {
		console.log(e); // tslint:disable-line
		process.exit(0);
	});
