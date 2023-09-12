import type { ConnectRouter } from "@connectrpc/connect";
import { ServerService } from '@buf/xeonr_sagl-servers.connectrpc_es/serversapi/v1/api_connect.js';

import { getServer } from './getServer.js';
import { wrap } from '../../util/wrap.js';
import { listServers } from './listServers.js';
import { trackServer } from './trackServer.js';

export default function (router: ConnectRouter) {
	router.rpc(ServerService, ServerService.methods.getServer, wrap(getServer));
	router.rpc(ServerService, ServerService.methods.listServers, wrap(listServers));
	router.rpc(ServerService, ServerService.methods.trackServer, wrap(trackServer));
}
