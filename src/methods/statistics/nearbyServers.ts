import type { HandlerContext } from '@connectrpc/connect';
import { NearbyServersRequest, NearbyServersResponse, NearbyServersResponse_CloseGameServer } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { Server } from '../../models/index.js';
import { getRecentDataTimestamp } from '../../util/utils.js';
import { lookupIP } from '../../util/MaxMind.js';

export async function nearbyServers(_: NearbyServersRequest, context: HandlerContext): Promise<NearbyServersResponse> {
	let latitude = 0;
	let longitude = 0;

	try {
		const ip = lookupIP(context.requestHeader.get('CF-Connecting-IP') ?? '')
		latitude = ip.city?.location?.latitude ?? 0;
		longitude = ip.city?.location?.longitude ?? 0;
	} catch(e) {
		//
	}

	const results = await Server.aggregate([
		{
			$geoNear: {
				near: { type: 'Point', coordinates: [longitude, latitude] },
				distanceField: 'distance',
				key: 'ipLocation',
				spherical: true,
				distanceMultiplier: 0.000621371,
				query: { lastUpdatedAt: { $gte: getRecentDataTimestamp() } },
			}
		}
	])

	return new NearbyServersResponse({
		servers: results.map(data => new NearbyServersResponse_CloseGameServer({
			id: data.address,
			hostname: data.hostname,
			country: data.country,
			distanceMi: data.distance, // apparently * 6371 for km?!
			latitude: data.ipLocation.coordinates[1],
			longitude: data.ipLocation.coordinates[0],
			maxPlayers: data.maxPlayers,
			onlinePlayers: data.onlinePlayers,
		})),
		currentLatitude: latitude,
		currentLongitude: longitude,
	});
}
