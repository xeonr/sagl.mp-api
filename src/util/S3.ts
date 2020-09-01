import * as aws from 'aws-sdk';
import { get } from 'config';
import { Stream } from 'stream';

const s3: aws.S3 = new aws.S3({
	accessKeyId: get('s3.accessKeyId'),
	secretAccessKey: get('s3.secretAccessKey'),
	endpoint: get('s3.endpoint'),
	region: get('s3.region'),
	s3ForcePathStyle: true,
	signatureVersion: 'v4',
});

class S3CDN {
	public getUrl(key: string): string {
		return s3.getSignedUrl('getObject', {
			Bucket: get('s3.bucket'),
			Key: key,
		});
	}

	public async upload(key: string, data: string | Buffer | Stream, kind?: string, encoding?: string): Promise<void> {
		await s3.upload({
			Key: key,
			Body: data,
			Bucket: get('s3.bucket'),
			ContentType: kind,
			ContentEncoding: encoding,
		}).promise();
	}
}

export const S3 = new S3CDN();
