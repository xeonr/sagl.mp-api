import config from 'config';

import { Storage } from '@google-cloud/storage';

const storage = config.has('storage.auth') ? new Storage({
	projectId: config.get('storage.auth.project_id'),
	credentials: config.get('storage.auth'),
}) : new Storage();

class S3CDN {
	public listFiles(key: string): Promise<string[]> {
		return storage.bucket(config.get('storage.bucket')).getFiles({
			autoPaginate: true,
			prefix: key,
		}).then(([i]) => i.map(j => j.name));
	}

	public getFile(key: string): Promise<any> {
		return storage.bucket(config.get('storage.bucket')).file(key).download({
			decompress: true,
		}).then(([i]) => i.toString());
	}

	public async upload(key: string, data: string | Buffer, kind?: string): Promise<void> {
		await storage.bucket(config.get('storage.bucket')).file(key).save(data, {
			contentType: kind,
			gzip: true,
		});
	}
}

export const S3 = new S3CDN();
