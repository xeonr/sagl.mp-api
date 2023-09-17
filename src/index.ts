import { fastify } from "fastify";
import cors from "@fastify/cors";
import { fastifyConnectPlugin } from "@connectrpc/connect-fastify";

import statsRoutes from './methods/statistics/index.js';
import serversRoutes from './methods/servers/index.js';
import timeseriesRoutes from './methods/timeseries/index.js';
import metaRoutes from './methods/meta/index.js';

(async () => {
	const server = fastify({
		// http2: false,
		clientErrorHandler: (err) => {
			console.log(err);
		}
	});

	server.setErrorHandler((err, _, res) => {
		console.log(err);
		res.send(err);
	})

	await server.register(cors, {});

	console.log("fastify");

	await server.register(fastifyConnectPlugin, {
		routes: (router) => {
			statsRoutes(router);
			serversRoutes(router);
			timeseriesRoutes(router);
			metaRoutes(router);
		},
		logLevel: "debug",
	});


	await server.listen({
		host: "0.0.0.0",
		port: 8080,
	});

	console.log('Server is listening', server.printRoutes())
})();
