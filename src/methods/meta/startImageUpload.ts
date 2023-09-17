import type { HandlerContext } from '@connectrpc/connect';
import {
	StartImageUploadRequest, StartImageUploadResponse,
} from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb';
import { withAuthentication } from "../servers/helpers";
import { v4 } from "uuid";
import { Code, ConnectError } from "@connectrpc/connect";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const client = new S3Client({
	region: "eu-west-2",
});



export async function startImageUpload(request: StartImageUploadRequest, ctx: HandlerContext): Promise<StartImageUploadResponse> {
	const { } = withAuthentication(ctx);

	if (request.filesize >= 10000000) {
		throw new ConnectError('File size too large', Code.OutOfRange);
	}

	const uuid = v4();

	const command = new PutObjectCommand({
		ContentType: request.contentType,
		ContentLength: +request.filesize.toString(),
		Key: `usercontent/${uuid}`,
		Bucket: process.env.S3_SERVER_BUCKET,
	});
	const url = await getSignedUrl(client, command, { expiresIn: 3600 });

	return new StartImageUploadResponse({
		uploadId: uuid,
		uploadUrl: url,
	});
}
