import { NearbyServersRequest, NearbyServersResponse, NearbyServersResponse_CloseGameServer } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { Server } from '../../models';
import { getRecentDataTimestamp } from '../../util/utils';

export async function nearbyServers(_: NearbyServersRequest): Promise<NearbyServersResponse> {
	const latitude = 52.3788758;
	const longitude = -1.3086567;

	const results = await Server.aggregate([
		{
			$geoNear: {
				near: { type: 'Point', coordinates: [longitude, latitude] },
				distanceField: 'distance',
				key: 'ipLocation',
				spherical: true,
				distanceMultiplier: 0.000621371,
				query: { lastUpdatedAt: { $gte: getRecentDataTimestamp().toISOString() } },
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
