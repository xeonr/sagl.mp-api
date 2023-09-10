import { GetGameModeDistributionRequest, GetGameModeDistributionResponse, GetGameModeDistributionResponse_GameMode } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { aggregate } from './shared';

export async function getGameModeDistribution(_: GetGameModeDistributionRequest): Promise<GetGameModeDistributionResponse> {
	return aggregate('gamemode', [])
		.then(response => new GetGameModeDistributionResponse({
			gameModes: response.map(({ key, value }) => new GetGameModeDistributionResponse_GameMode({
				count: value,
				gamemode: key,
			})),
		}));
}