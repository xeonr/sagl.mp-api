import { type HandlerContext  } from '@connectrpc/connect';
import { ListClaimedServersRequest, ListClaimedServersResponse } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { Server, ServerClaim, ServerConfiguration } from '../../models';
import { mapServer, withAuthentication } from './helpers';

export async function listClaimedServers(request: ListClaimedServersRequest, ctx: HandlerContext): Promise<ListClaimedServersResponse> {
	const { discord, scopes } = withAuthentication(ctx);
	const claimedServers = (request.admin && scopes.includes('admin')) ? await ServerConfiguration.find({})
	.then(r => r.map((data) => `${data.ip}:${data.port}`)) : await ServerClaim.find(
		{ discordUsername: discord.username },
	).then(r => r.map((data) => `${data.ip}:${data.port}`));

	const servers = await Server.aggregate([
		{ $match: { address: { $in: claimedServers } } },
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
		}
	]);


	return new ListClaimedServersResponse({
		server: await Promise.all(servers.map((server) => mapServer(server))),
	});
}
