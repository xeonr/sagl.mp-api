import type { HandlerContext } from "@connectrpc/connect";
import { ConnectError, Code } from "@connectrpc/connect";
import {
	ClaimServerRequest,
	ClaimServerRequest_ClaimType,
	ClaimServerResponse,
} from "@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js";
import { Server, ServerClaim } from "../../models";
import { query } from "@xeonr/samp-query";
import { withAuthentication } from './helpers';

const ruleKeys = ["owners", "discord-owners", "sagl-owners"];


async function hasClaimed(ip: string, port: number, type: ClaimServerRequest_ClaimType, username: string): Promise<boolean> {
	if (type === ClaimServerRequest_ClaimType.HTTP) {
		return  fetch(`http://${ip}/sagl.json`, {
			headers: new Headers({
				'user-agent': '',
			}),
		})
			.then(r => {
				if (r.status !== 200) {
					throw new Error('bad status');
				}
				return r.json()
			})
			.then(res => {
				if (res.owners && Array.isArray(res.owners) && res.owners.length && res.owners.some((owner: string) => owner.toLowerCase() === username.toLowerCase())) {
					return true;
				}

				return false;
			})
			.catch(() => false);
	} else {
		const ping = await query({
			host: ip,
			port: port,
			timeout: 3000,
		}).catch(() => null);

		if (!ping) {
			return false;
		}

		const hasClaimant = ruleKeys.some((val) => {
			if (!ping.rules[val]) {
				return false;
			}
			const parts = ping.rules[val].split(/ ,/);

			return parts.length
				? parts.some(
					(part) =>
						part.toLowerCase() ===
						username.toLowerCase()
				)
				: false;
		});

		if (ping.hostname.toLowerCase().includes(`sagl@${username.toLowerCase()}`) || ping.rules.weburl.toLowerCase().includes(`sagl@${username.toLowerCase()}`)) {
			return true;
		}

		if (hasClaimant) {
			return true;
		}
	}

	return false;
}

export async function claimServer(
	req: ClaimServerRequest,
	ctx: HandlerContext
): Promise<ClaimServerResponse> {
	const { userId, discord } = withAuthentication(ctx);

	const server = await Server.findOne({ ip: req.ipAddress, port: req.port });

	if (!server) {
		throw new ConnectError("Server not found", Code.NotFound);
	}

	const claimed = await hasClaimed(req.ipAddress, req.port, req.claimType, discord.username);

	if (!claimed) {
		return new ClaimServerResponse({
			success: false,
		});
	}

	const claim = await ServerClaim.findOne({ ip: req.ipAddress, port: req.port, discordUsername: discord.username });
	if (!claim) {
		await ServerClaim.create({
			ip: req.ipAddress,
			port: req.port,
			discordUsername: discord.username,
			discordId: discord.id,
			discordAvatar: discord.avatar,
			saglId: userId,
		});
	}

	return new ClaimServerResponse({
		success: true,
	});
}
