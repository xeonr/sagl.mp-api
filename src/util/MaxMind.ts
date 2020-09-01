import { Asn, City, Reader } from '@maxmind/geoip2-node';
import ReaderModel from '@maxmind/geoip2-node/dist/src/readerModel'; // tslint:disable-line
import { join } from 'path';

import { Logger } from './Logger';

export let asn: ReaderModel;
export let city: ReaderModel;

(async () => {
	asn = await Reader.open(join(__dirname, '../db/GeoLite2-ASN.mmdb'));
	city = await Reader.open(join(__dirname, '../db/GeoLite2-City.mmdb'));
})().catch((e: Error) => { Logger.error('Unable to load GeoIP DB', e.message); });

export function lookupIP(ip: string): { asn: Asn; city: City } {
	if (!city || !asn) {
		throw new Error('GeoIP is not configured');
	}

	return {
		city: city.city(ip),
		asn: asn.asn(ip),
	};
}
