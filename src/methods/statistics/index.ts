import type { ConnectRouter } from "@connectrpc/connect";
import { StatisticsService } from '@buf/xeonr_sagl-servers.connectrpc_es/serversapi/v1/api_connect.js';

import { currentPlayers } from './currentPlayers.js';
import { getGameLanguageDistribution } from './getGameLanguageDistribution.js';
import { getGameModeDistribution } from './getGameModeDistribution.js';
import { getGameVersionDistribution } from './getGameVersionDistribution.js';
import { getNetworkASNDistribution } from './getNetworkASNDistribution.js';
import { getNetworkCountryDistribution } from './getNetworkCountryDistribution.js';
import { nearbyServers } from './nearbyServers.js';
import { wrap } from '../../util/wrap.js';

export default function (router: ConnectRouter) {
	router.rpc(StatisticsService, StatisticsService.methods.currentPlayers, wrap(currentPlayers));
	router.rpc(StatisticsService, StatisticsService.methods.getGameLanguageDistribution, wrap(getGameLanguageDistribution));
	router.rpc(StatisticsService, StatisticsService.methods.getGameModeDistribution, wrap(getGameModeDistribution));
	router.rpc(StatisticsService, StatisticsService.methods.getGameVersionDistribution, wrap(getGameVersionDistribution));
	router.rpc(StatisticsService, StatisticsService.methods.getNetworkASNDistribution, wrap(getNetworkASNDistribution));
	router.rpc(StatisticsService, StatisticsService.methods.getNetworkCountryDistribution, wrap(getNetworkCountryDistribution));
	router.rpc(StatisticsService, StatisticsService.methods.nearbyServers, wrap(nearbyServers));
}
