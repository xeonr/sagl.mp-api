import { ConnectError, Code } from '@connectrpc/connect';
import type { HandlerContext } from '@connectrpc/connect';
import { UnclaimServerRequest, UnclaimServerResponse } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { hasClaimedServer, withAuthentication } from './helpers.js';
import { ServerClaim } from '../../models/index.js';

export async function unclaimServer(request: UnclaimServerRequest, ctx: HandlerContext): Promise<UnclaimServerResponse> {
	const { discord } = withAuthentication(ctx);
	const hasClaimed = await hasClaimedServer(request.ipAddress, request.port, ctx);

	if (!hasClaimed) {
		throw new ConnectError('You do not own this server', Code.FailedPrecondition);
	}

	await ServerClaim.deleteOne({
		ip: request.ipAddress,
		port: request.port,
		discordUsername: discord.username,
	});

	return new UnclaimServerResponse({
		success: true,
	});
}
