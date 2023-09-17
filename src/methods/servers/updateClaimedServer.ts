import { ConnectError } from '@connectrpc/connect';
import { Code } from '@connectrpc/connect';
import type { HandlerContext } from '@connectrpc/connect';
import { GetServerRequest, UpdateClaimedServerRequest, UpdateClaimedServerResponse } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb';
import { hasClaimedServer, withAuthentication } from './helpers';
import { ServerConfiguration } from '../../models';
import { getServer } from './getServer';

export async function updateClaimedServer(request: UpdateClaimedServerRequest, ctx: HandlerContext): Promise<UpdateClaimedServerResponse> {
	const hasClaimed = await hasClaimedServer(request.ipAddress, request.port, ctx);
	const { scopes } = withAuthentication(ctx);

	if (!hasClaimed) {
		throw new ConnectError('You do not own this server', Code.FailedPrecondition);
	}

	const adminSet = {
		is_supporter: request.saglMetadata?.isSupporter,
	}


	await ServerConfiguration.updateOne({
		ip: request.ipAddress,
		port: request.port,
	}, {
		$set: {
			ip: request.ipAddress,
			port: request.port,
			description: request.saglMetadata?.description,
			display_name: request.saglMetadata?.displayName,
			hostname: request.saglMetadata?.hostname,
			profile_icon: request.saglMetadata?.profileIcon,
			socials: request.saglMetadata?.socialNetworks,
			...(scopes.includes('admin') ? adminSet : {}),
		},
	}, { upsert: true })

	const server = await getServer(new GetServerRequest({
		target: `${request.ipAddress}:${request.port}`,
	}));

	return new UpdateClaimedServerResponse({
		server: server.server,
	});
}
