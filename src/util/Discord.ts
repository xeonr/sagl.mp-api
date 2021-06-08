import c from 'config';
import PQueue from 'p-queue';
import { get } from 'request-promise';

import { Logger } from './Logger';
import { redisPub } from './Redis';

export interface IPartialGuild {
	id: string;
	name: string;
	avatar: string;
}

export async function getCachedInvite(inviteId: string): Promise<IPartialGuild | null> {
	const res = await redisPub.get(`discordInvites:${inviteId}`);

	return res ? JSON.parse(res) : null;
}

const q = new PQueue({
	concurrency: 1,
	timeout: 3000,
	autoStart: true,

});

export async function getInvite(inviteId: string): Promise<{ id: string; name: string; avatar: string } | null> {
	const guild = await getCachedInvite(inviteId);

	if (guild) {
		return guild;
	}

	if (await redisPub.get(`deadInvites:${inviteId}`)) {
		return;
	}

	const resp = await q.add(() => {
		return get(`https://discordapp.com/api/invites/${inviteId}`, {
			json: true,
			timeout: 1000,
			headers: {
				Authorization: `Bot ${c.get('discord.key')}`,
			},
		}).catch(async (e) => {
			if (e.message.includes('10006')) {
				await redisPub.set(`deadInvites:${inviteId}`, 'true');
			}

			Logger.warn(e.message);

			return null;
		});
	});

	if (resp === null) {
		return null;
	}

	const prefix = resp.guild.icon.startsWith('a_') ? 'gif' : 'png';

	const response =  {
		id: resp.guild.id,
		name: resp.guild.name,
		avatar: `https://cdn.discordapp.com/icons/${resp.guild.id}/${resp.guild.icon}.${prefix}`,
	};

	await redisPub.setex(`discordInvites:${inviteId}`, 60 * 60 * 3, JSON.stringify(response));

	return response;
}
