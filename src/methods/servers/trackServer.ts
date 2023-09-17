import { GetServerRequest, TrackServerRequest, TrackServerResponse } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { GameServerPointer, Server } from '../../models';
import { getServer } from './getServer';
import { mapServer } from './helpers';
import { query } from '@xeonr/samp-query';
import { lookupIP } from '../../util/MaxMind';
import type { CountryRecord } from '@maxmind/geoip2-node';

function addPointer(ip: string, port: number): Promise<void> {
	return GameServerPointer.findOne({ ip, port }).then(async (pointer) => {
		if (pointer) return;
		const newPointer = new GameServerPointer({
			address: `${ip}:${port}`,
			ip,
			port,
			sacnr: false,
			openmp: false,
		});
		await newPointer.save();
	});
}
export async function trackServer(request: TrackServerRequest): Promise<TrackServerResponse> {

	return query({ host: request.ipAddress, port: request.port, timeout: 3000 })
		.then(async req => {
			const server = await getServer(new GetServerRequest({
				target: `${req.address}:${req.port}`,
			}));

			if (server?.server) {
				console.log('app cache hit');
				return new TrackServerResponse({
					server: server.server,
				});
			}

			let asn: any = { autonomousSystemOrganization: null, autonomousSystemNumber: null };
			let city: any = { country: { isoCode: null }, city: { names: { en: null }, location: {} } };

			try {
				const res = lookupIP(req.address);
				asn = res.asn;
				city = res.city;
			} catch (e) {
				console.log(e)
			}

			console.log(asn, city, req.address);

			const mongoServer = new Server({
				online: true,
				lastUpdatedAt: new Date(),
				address: `${req.address}:${req.port}`,
				hosted: false,
				sacnr: false,
				openmp: false,
				ip: req.address,
				ipLocation: city.latitude != undefined && city.latitude !== null && city.longitude !== null ? {
					type: 'Point',
					coordinates: [
						city.longitude,
						city.latitude,
					],
				} : null,
				port: request.port,
				country: (<CountryRecord>city.country)?.isoCode,
				city: (<CountryRecord>city.city)?.names ? (<CountryRecord>city.city).names.en : null,
				asnName: asn.autonomousSystemOrganization ?? 'unknown',
				asnId: asn.autonomousSystemNumber ?? -1,
				origin: 'sagl-webapp',
				lastOnlineAt: new Date(),
				players: req.players || [],
				hostname: req.hostname,
				gamemode: req.gamemode,
				language: req.language,
				passworded: req.passworded,
				maxPlayers: req.maxplayers,
				onlinePlayers: req.online,
				ping: -1,
				rules: req.rules,
			});

			await mongoServer.save();
			await addPointer(req.address, req.port);

			const newServer = await mapServer(mongoServer);

			return new TrackServerResponse({
				server: newServer,
			});
		})
		.catch((e) => {
			console.log(e);
			// who
			return new TrackServerResponse({});
		});
}
