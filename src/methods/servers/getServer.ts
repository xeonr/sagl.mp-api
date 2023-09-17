import { GetServerRequest, GetServerResponse } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { Server } from '../../models';
import { mapServer } from './helpers';

export async function getServer(request: GetServerRequest): Promise<GetServerResponse> {
	const server = await Server.aggregate([
		{ $match: { address: request.target } },
		{
			$lookup: {
				from: 'serverclaims',
				as: 'saglOwners',
				let: { ip: '$ip', port: '$port' },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ['$ip', '$$ip'] },
									{ $eq: ['$port', '$$port'] },
								]
							}
						}
					},
					{ $project: { _id: 0, username: "$discordUsername", avatar: "$discordAvatar", "id": "$discordId" } }
				],
			}
		},
		{
			$lookup: {
				from: 'serverconfigurations',
				as: 'saglconfig',
				let: { ip: '$ip', port: '$port' },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ['$ip', '$$ip'] },
									{ $eq: ['$port', '$$port'] },
								]
							}
						}
					},
				],
			}
		},
		// {
		// 	"$unwind": "$saglconfig",
		// }
	])

	console.log(JSON.stringify(server, null, 2));

	return new GetServerResponse({
		server: server?.length ? await mapServer(server[0]) : undefined,
	});
}
