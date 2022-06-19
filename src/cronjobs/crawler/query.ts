import { getInvite, IPartialGuild } from './../../util/Discord';
import { Asn, CountryRecord, LocationRecord } from '@maxmind/geoip2-node';
import { IQueryableServers } from './gather';
import { ISAMPQuery, query as querySamp } from '@xeonr/samp-query';
import pRetry from 'p-retry';
import { lookupIP } from '../../util/MaxMind';
import { pick } from 'lodash';
import { inferSocials } from '../../routes/server/servers';
import { Logger } from '../../util/Logger';
import * as ping from 'ping';

export interface IQueryValue {
	hostname: string;
	port: number;
	hosted: boolean;
	sacnr?: boolean;
	openmp?: boolean;
	payload: ISAMPQuery;
	ip: { address: string; asn: Asn; country: string; city: string | null; latitude: number | null; longitude: number | null; ping: number };
	guild?: IPartialGuild;
}

/**
 * Query SA:MP metadata
 *
 * @param address
 * @returns
 */
function querySAMP(address: string): Promise<ISAMPQuery> {
	const [hostname, port] = address.split(':');

	return pRetry((retry: number) => {
		return querySamp({ host: hostname, port: +port, timeout: 2000 })
			.catch(err => {
				Logger.debug('Failed to query server', {
					retry,
					hostname, port
				});

				throw err;
			})
	}, { retries: 4 });
}

async function queryPing(address: string): Promise<number | null> {
	const [ip] = address.split(':');
	return ping.promise.probe(ip, {
		timeout: 1,
		deadline: 2,
		extra: ['-i 0.2', '-c 3'],
	})
	.then(r => {
		if (r.avg === 'unknown') {
			return null;
		}

		return +r.avg;
	})
}

/**
 * Try to identify metadata about the associated discord guild.
 *
 * @param payload SA:MP query payload.
 * @returns
 */
async function inferDiscordGuild(payload: ISAMPQuery) {
	const url = inferSocials(payload?.rules.weburl);

	if (!url.has('discord')) {
		return null;
	}

	return getInvite(url.get('discord'))
		.catch(() => null);
}

/**
 * Query all metadata about a SA:MP ip address
 * @param address SA:MP ip and port
 * @param servers known information about servers
 * @returns
 */
export async function query(address: string, servers: IQueryableServers): Promise<IQueryValue> {
	const [hostname, port] = address.split(':');

	let asn: any = { autonomousSystemOrganization: null, autonomousSystemNumber: null };
	let city: any = { country: { isoCode: null }, city: { names: { en: null }, location: {} } };

	try {
		const res = lookupIP(hostname);
		asn = res.asn;
		city = res.city;
	} catch (e) {
		console.log(e)
	}

	const [sampPayload, ping]: [
		ISAMPQuery | null,
		number | null,
	] = await Promise.all([
		querySAMP(address)
			.catch(() => null),
		queryPing(address),
	]);

	return {
		hostname: address,
		port: +port,
		hosted: servers.hosted.has(address),
		openmp: servers.hosted.has(address),
		sacnr: false,
		payload: sampPayload,
		ip: {
			address: hostname,
			ping: ping,
			asn: pick(asn, ['autonomousSystemOrganization', 'autonomousSystemNumber']),
			country: (<CountryRecord>city.country)?.isoCode,
			city: (<CountryRecord>city.city).names ? (<CountryRecord>city.city).names.en : null,
			latitude: (<LocationRecord>city.location) ? (<LocationRecord>city.location).latitude : null,
			longitude: (<LocationRecord>city.location) ? (<LocationRecord>city.location).longitude : null,
		},
		guild: sampPayload ? await inferDiscordGuild(sampPayload) : null,
	};
}
