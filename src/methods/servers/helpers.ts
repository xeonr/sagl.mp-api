import { ConnectError, type HandlerContext, Code } from '@connectrpc/connect';
import { Server as ServerType } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { ServerClaim, type IServer } from '../../models';
import { default as normalizeUrl } from 'normalize-url';
import { verify } from 'jsonwebtoken-esm';


export const withAuthentication = (
	ctx: HandlerContext
): {
	discord: {
		id: string;
		avatar: string;
		username: string;
	};
	scopes: string[];
	userId: string;
} => {
	const authz = ctx.requestHeader.get("authorization");
	if (!authz)
		throw new ConnectError("Missing authorization", Code.PermissionDenied);
	const token = authz.split(" ")[1];
	if (!token)
		throw new ConnectError("Missing authorization", Code.PermissionDenied);

	let tk;
	try {
		tk = verify(token, process.env.JWT_TOKEN!);
	} catch (e) {
		throw new ConnectError(
			"Invalid authorization token",
			Code.PermissionDenied
		);
	}

	return tk as any;
};

export function inferSocials(weburl?: string): Map<string, string> {
	const map = new Map<string, string>();

	try {
		const url = normalizeUrl((weburl || '').trim(), { defaultProtocol: 'https', stripAuthentication: true, sortQueryParameters: true });
		const parsed = new URL(url);
		const path = parsed.pathname.split('/');

		if (parsed.hostname === 'vk.com') {
			map.set('vk', path[1]);
		} else if (parsed.hostname === 'discord.gg') {
			map.set('discord', path[1]);
		} else if (parsed.hostname === 'facebook.com' || parsed.hostname === 'www.facebook.com') {
			map.set('facebook', parsed.pathname);
		} else if (parsed.hostname === 'www.sa-mp.com') {
			// na
		} else {
			map.set('url', url);
		}
	} catch (e) {
		//
	}

	return map;
}

export function fetchSocials(_: IServer, weburl: string): { [key: string]: string } {
	const map: Map<string, string> = inferSocials(weburl);

	try {
		const url = normalizeUrl((weburl || '').trim(), { defaultProtocol: 'https', stripAuthentication: true, sortQueryParameters: true });
		const parsed = new URL(url);
		const path = parsed.pathname.split('/');

		if (parsed.hostname === 'vk.com') {
			map.set('vk', path[1]);
		} else if (parsed.hostname === 'discord.gg') {
			map.set('discord', path[1]);
		} else if (parsed.hostname === 'facebook.com' || parsed.hostname === 'www.facebook.com') {
			map.set('facebook', parsed.pathname);
		} else if (parsed.hostname === 'www.sa-mp.com') {
			// na
		} else {
			map.set('url', url);
		}
	} catch (e) {
		//
	}

	// userSocials
	// for (const [k, v] of Object.entries({})) {
	// 	map.set(k, v);
	// }

	// if (gameServer.userDiscordInvite) {
	// 	map.set('discord', gameServer.userDiscordInvite);
	// }

	const resp: { [key: string]: string } = {};

	for (const [k, v] of map.entries()) {
		resp[k] = v;
	}

	return resp;
}

function getUserContent(path: string): string {
	if (path.startsWith('https://')) return path;

	return `https://sagl-servers-prod.s3.eu-west-2.amazonaws.com/usercontent/${path}`;
}
export async function mapServer(server: IServer): Promise<ServerType> {
	const socials = fetchSocials(server, server.rules.weburl);

	return new ServerType({
		id: server.address,
		hostname: server.port === 7777 ? server.ip : `${server.ip}:${server.port}`,
		ipAddress: server.ip,
		address: `${server.ip}:${server.port}`,
		gamemode: server.gamemode,
		language: server.language,
		port: server.port,
		name: server.hostname,
		isHosted: server.hosted,
		isPassworded: server.passworded,
		isOnline: new Date(server.lastOnlineAt) >= new Date(+new Date() - 1000 * 60 * 30),
		lastOnlineAt: new Date(server.lastOnlineAt).toISOString(),
		capturedAt: new Date(server.lastUpdatedAt).toISOString(),
		players: {
			currentPlayers: server.onlinePlayers,
			maxPlayers: server.maxPlayers,
			exceededSampLimit: server.onlinePlayers >= 100,
		},
		rules: server.rules,
		networkDetails: {
			asn: String(server.asnId),
			asnName: server.asnName,
			country: server.country,
		},
		saglMetadata: {
			socialNetworks: (server as any).saglconfig?.[0]?.socials ?? socials,
			description: (server as any).saglconfig?.[0]?.description ?? undefined,
			displayName: (server as any).saglconfig?.[0]?.display_name ?? undefined,
			hostname: (server as any).saglconfig?.[0]?.hostname ?? undefined,
			profileIcon: (server as any).saglconfig?.[0]?.profile_icon ? getUserContent((server as any).saglconfig?.[0]?.profile_icon) : undefined,
			isSupporter: (server as any).saglconfig?.[0]?.is_supporter ?? false,
		},
		saglOwners: (server as any).saglOwners || [],
	});
}

export async function hasClaimedServer(ip: string, port: number, ctx: HandlerContext): Promise<boolean> {
	const { discord, scopes } = withAuthentication(ctx);

	if (scopes.includes('admin')) {
		return true;
	}

	return ServerClaim.findOne({ ip, port, discordUsername: discord.username }).then((res) => !!res);
}
