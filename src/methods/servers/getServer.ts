import { GetServerRequest, GetServerResponse, Server as ServerType } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { Server, type IServer } from '../../models';
import { default as normalizeUrl } from 'normalize-url';

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

export async function mapServer(server: IServer): Promise<ServerType> {
	const socials = fetchSocials(server, server.rules.weburl);
	return new ServerType({
		id: server.address,
		hostname: server.ip,
		port: server.port,
		address: server.port === 7777 ? server.ip : `${server.ip}:${server.port}`,
		name: server.hostname,
		isSupporter: false,
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
		metadata: {
			socialNetworks: socials,
		}
	});
}

export async function getServer(request: GetServerRequest): Promise<GetServerResponse> {
	const server = await Server.findOne({ address: request.target })
	
	return new GetServerResponse({
		server: server ? await mapServer(server) : undefined,
	});
}