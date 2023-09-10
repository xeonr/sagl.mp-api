import { GetGameLanguageDistributionRequest, GetGameLanguageDistributionResponse, GetGameLanguageDistributionResponse_GameLanguage } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { aggregate } from './shared';

export async function getGameLanguageDistribution(_: GetGameLanguageDistributionRequest): Promise<GetGameLanguageDistributionResponse> {
	return aggregate('language', [])
		.then(response => new GetGameLanguageDistributionResponse({
			gameLanguages: response.map(({ key, value }) => new GetGameLanguageDistributionResponse_GameLanguage({
				count: value,
				language: key,
			})),
		}));
}