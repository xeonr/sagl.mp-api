import { GetServerRequest, GetServerResponse } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { Server } from '../../models/index.js';
import { mapServer } from './helpers.js';

export async function getServer(request: GetServerRequest): Promise<GetServerResponse> {
	const server = await Server.aggregate([
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
		{
			$match: {
				$or: [
					{ address: request.target },
					{ "saglconfig.0.hostname": request.target.split(':')[0], port: +request.target.split(':')[1] ?? 7777 },
				],
			}
		},
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
		// {
		// 	"$unwind": "$saglconfig",
		// }
	])

	console.log(JSON.stringify(server, null, 2));

	return new GetServerResponse({
		server: server?.length ? await mapServer(server[0]) : undefined,
	});
}
