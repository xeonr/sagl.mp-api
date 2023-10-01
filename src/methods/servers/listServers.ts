import {
	FieldName,
	ListServersRequest,
	ListServersRequest_ListServersRequestFilter,
	ListServersRequest_Sort,
	ListServersResponse,
	Operator,
} from "@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js";
import { Server } from "../../models/index.js";
import { mapServer } from "./helpers.js";
import type { PipelineStage } from "mongoose";
import { getRecentDataTimestamp } from "../../util/utils.js";
import * as crypto from "crypto";

const fieldMap: {
	[key in FieldName]: { key: string; transform?: (key: string[]) => any };
} = {
	[FieldName.CURRENT_PLAYERS]: {
		key: "onlinePlayers",
		transform: (val: string[]) => val.map((v) => +v),
	},
	[FieldName.MAX_PLAYERS]: {
		key: "maxPlayers",
		transform: (val: string[]) => val.map((v) => +v),
	},
	[FieldName.GAME_LANGUAGE]: {
		key: "language",
	},
	[FieldName.GAME_MODE]: {
		key: "gamemode",
	},
	[FieldName.GAME_VERSION]: {
		key: "rules.version",
	},
	[FieldName.NETWORK_COUNTRY]: {
		key: "country",
	},
	[FieldName.COUNTRY]: {
		key: "country",
	},
	[FieldName.NETWORK_ASN]: {
		key: "asnId",
		transform: (val: string[]) => val.map((v) => +v),
	},
	[FieldName.NETWORK_NAME]: {
		key: "asnName",
	},
	[FieldName.IS_PASSWORDED]: {
		key: "passworded",
		transform: (val: string[]) => val.map((v) => v === "true"),
	},
	[FieldName.IS_HOSTED]: {
		key: "hosted",
		transform: (val: string[]) => val.map((v) => v === "true"),
	},
	[FieldName.IS_SUPPORTER]: {
		key: "saglconfig.0.is_supporter",
		transform: (val: string[]) => val.map((v) => v === "true"),
	},
	[FieldName.IS_OPENMP]: {
		key: "rules.openmp",
		transform: (val: string[]) => val.map((v) => v === "true"),
	},
	[FieldName.ADDRESS]: {
		key: "address",
	},
	[FieldName.QUERY]: {
		key: "query",
	},
	[FieldName.DISCORD_GUILD]: {
		key: "query",
	},
	[FieldName.IS_OPENMP]: {
		key: 'openmp'
	}
};

function generateMongoQuery(
	request: ListServersRequest_ListServersRequestFilter,
	offset: number
): {
	query: PipelineStage[];
	stages: PipelineStage[];
	limit: number;
	offset: number;
} {
	const stages: PipelineStage[] = [
		{ $match: { lastUpdatedAt: { $gte: getRecentDataTimestamp() } } },
		{
			$lookup: {
				from: 'serverconfigurations',
				as: 'saglconfig',
				let: { ip: '$ip', port: '$port' },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ['$ip', '$$ip'] },
									{ $eq: ['$port', '$$port'] },
								]
							}
						}
					},
				],
			}
		},
	];

	stages.push(
		...(request.filter
			.map((filter) => {
				const fieldName = fieldMap[filter.field].key;
				const fieldValue = fieldMap[filter.field].transform
					? fieldMap[filter.field].transform?.(filter.value)
					: filter.value;

				if (filter.operator === Operator.EQUAL) {
					if (fieldValue.length <= 1) {
						return { $match: { [fieldName]: fieldValue[0] } };
					}

					return { $match: { [fieldName]: { $in: fieldValue } } };
				}

				if (filter.operator === Operator.NOT_EQUAL) {
					if (filter.value.length <= 1) {
						return {
							$match: { [fieldName]: { $ne: fieldValue[0] } },
						};
					}

					return { $match: { [fieldName]: { $nin: fieldValue } } };
				}

				if (filter.operator === Operator.GREATER_THAN) {
					return { $match: { [fieldName]: { $gt: fieldValue } } };
				}

				if (filter.operator === Operator.LESS_THAN) {
					return { $match: { [fieldName]: { $lt: fieldValue } } };
				}

				if (filter.operator === Operator.BETWEEN) {
					return {
						$match: {
							[fieldName]: {
								$gte: fieldValue[0],
								$lte: fieldValue[1],
							},
						},
					};
				}

				return null;
			})
			.filter((i) => i !== null) as PipelineStage[])
	);

	stages.push({
		$sort: {
			[fieldMap[request.sort!.field].key]: request.sort?.ascending
				? 1
				: -1,
		},
	});

	return {
		query: [...stages, { $limit: Math.min(100, request.limit) }],
		stages,
		limit: request.limit,
		offset: offset + request.limit,
	};
}

const encrypt = (plainText: string, password: string): string => {
	const iv = crypto.randomBytes(16);
	const key = crypto
		.createHash("sha256")
		.update(password)
		.digest("base64")
		.substr(0, 32);
	const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

	let encrypted = cipher.update(plainText);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return iv.toString("hex") + ":" + encrypted.toString("hex");
};

const decrypt = (encryptedText: string, password: string): string => {
	const textParts = encryptedText.split(":");
	const iv = Buffer.from(textParts.shift()!, "hex");

	const encryptedData = Buffer.from(textParts.join(":"), "hex");
	const key = crypto
		.createHash("sha256")
		.update(password)
		.digest("base64")
		.substr(0, 32);
	const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

	const decrypted = decipher.update(encryptedData);
	const decryptedText = Buffer.concat([decrypted, decipher.final()]);
	return decryptedText.toString();
};
function createToken(
	stages: PipelineStage[],
	offset: number,
	limit: number
): string {
	return encrypt(
		Buffer.from(JSON.stringify({ stages, offset, limit })).toString(
			"base64"
		),
		"luke"
	);
}

function decodeToken(token: string): {
	stages: PipelineStage[];
	offset: number;
	limit: number;
} {
	return JSON.parse(Buffer.from(decrypt(token, "luke"), "base64").toString());
}

export async function listServers(
	request: ListServersRequest
): Promise<ListServersResponse> {
	let query: PipelineStage[] = [];
	let token: string | undefined;

	if (request.requestType.case === "filter") {
		let req = request.requestType.value;

		if (!req.sort) {
			req.sort = new ListServersRequest_Sort({
				field: FieldName.ADDRESS,
				ascending: false,
			});
		}

		const response = generateMongoQuery(req, 0);
		query = response.query;
		token = createToken(response.stages, response.offset, response.limit);
	} else if (request.requestType.case === "continuationToken") {
		const decoded = decodeToken(request.requestType.value);
		query = decoded.stages;
		token = createToken(
			decoded.stages,
			decoded.offset + decoded.limit,
			decoded.limit
		);

		(query as any)[0]['$match']!['lastUpdatedAt']['$gte'] = new Date((query as any)[0]['$match']!['lastUpdatedAt']['$gte'])

		query.push(
			{ $skip: decoded.offset },
			{ $limit: Math.min(100, decoded.limit) }
		);
	} else {
		throw new Error("bad thing happened");
	}

	query.push({
		$lookup: {
			from: "serverclaims",
			as: "saglOwners",
			let: { ip: "$ip", port: "$port" },
			pipeline: [
				{
					$match: {
						$expr: {
							$and: [
								{ $eq: ["$ip", "$$ip"] },
								{ $eq: ["$port", "$$port"] },
							],
						},
					},
				},
				{
					$project: {
						_id: 0,
						username: "$discordUsername",
						avatar: "$discordAvatar",
						id: "$discordId",
					},
				},
			],
		},
	});

	return Server.aggregate(query).then(async (servers) => {
		return new ListServersResponse({
			server: await Promise.all(
				servers.map((server) => mapServer(server))
			),
			continuationToken: token,
		});
	});
}
