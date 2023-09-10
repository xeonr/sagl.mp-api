import type { ConnectRouter } from "@connectrpc/connect";
import { TimeseriesService } from '@buf/xeonr_sagl-servers.connectrpc_es/serversapi/v1/api_connect.js';

import { getServerPing } from './getServerPing.js';
import { getServerPlayers } from './getServerPlayers.js';
import { getPlayersByCountry } from './getPlayersByCountry.js';
import { wrap } from '../../util/wrap.js';

export default function (router: ConnectRouter) {
	router.rpc(TimeseriesService, TimeseriesService.methods.getServerPing, wrap(getServerPing));
	router.rpc(TimeseriesService, TimeseriesService.methods.getPlayersByCountry, wrap(getPlayersByCountry));
	router.rpc(TimeseriesService, TimeseriesService.methods.getServerPlayers, wrap(getServerPlayers));
}
