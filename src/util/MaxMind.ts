import { Asn, City, Reader } from '@maxmind/geoip2-node';
import ReaderModel from '@maxmind/geoip2-node/dist/src/readerModel'; // tslint:disable-line
import { join } from 'path';

export let asn: ReaderModel;
export let city: ReaderModel;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);


(async () => {
	asn = await Reader.open(join(__dirname, '../../db/GeoLite2-ASN.mmdb'));
	city = await Reader.open(join(__dirname, '../../db/GeoLite2-City.mmdb'));
})().catch((e: Error) => { console.error('Unable to load GeoIP DB', e.message); });

export function lookupIP(ip: string): { asn: Asn; city: City } {
	if (!city || !asn) {
		throw new Error('GeoIP is not configured');
	}

	return {
		city: city.city(ip),
		asn: asn.asn(ip),
	};
}
