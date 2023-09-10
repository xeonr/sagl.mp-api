import { GetNetworkCountryDistributionRequest, GetNetworkCountryDistributionResponse, GetNetworkCountryDistributionResponse_NetworkCountry } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { aggregate } from './shared';

export async function getNetworkCountryDistribution(_: GetNetworkCountryDistributionRequest): Promise<GetNetworkCountryDistributionResponse> {
	return aggregate('country', [])
		.then(response => new GetNetworkCountryDistributionResponse({
			networkCountries: response.map(({ key, value }) => new GetNetworkCountryDistributionResponse_NetworkCountry({
				count: value,
				country: key,
			})),
		}));
}