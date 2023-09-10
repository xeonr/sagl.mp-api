import { GetGameVersionDistributionRequest, GetGameVersionDistributionResponse, GetGameVersionDistributionResponse_GameVersion } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { aggregate } from './shared';

export async function getGameVersionDistribution(_: GetGameVersionDistributionRequest): Promise<GetGameVersionDistributionResponse> {
	return aggregate('rules.version', [])
		.then(response => new GetGameVersionDistributionResponse({
			gameVersions: response.map(({ key, value }) => new GetGameVersionDistributionResponse_GameVersion({
				count: value,
				version: key,
			})),
		}));
}