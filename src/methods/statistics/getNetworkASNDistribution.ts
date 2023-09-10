import { GetNetworkASNDistributionRequest, GetNetworkASNDistributionResponse, GetNetworkASNDistributionResponse_NetworkASN } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { aggregate } from './shared';

export async function getNetworkASNDistribution(_: GetNetworkASNDistributionRequest): Promise<GetNetworkASNDistributionResponse> {
	return aggregate('asnId', ['asnName'])
		.then(response => new GetNetworkASNDistributionResponse({
			networkAsns: response.map(({ key, value, asnName }) => new GetNetworkASNDistributionResponse_NetworkASN({
				asn: String(key),
				count: value,
				name: asnName,
			})),
		}));
}