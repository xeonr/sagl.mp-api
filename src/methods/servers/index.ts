import type { ConnectRouter } from "@connectrpc/connect";
import { ServerService } from '@buf/xeonr_sagl-servers.connectrpc_es/serversapi/v1/api_connect.js';

import { getServer } from './getServer.js';
import { wrap } from '../../util/wrap.js';
import { listServers } from './listServers.js';
import { trackServer } from './trackServer.js';
import { claimServer } from './claimServer.js';
import { listClaimedServers } from './listClaimedServers.js';
import { unclaimServer } from './unclaimServer.js';
import { updateClaimedServer } from './updateClaimedServer.js';

export default function (router: ConnectRouter) {
	router.rpc(ServerService, ServerService.methods.getServer, wrap(getServer));
	router.rpc(ServerService, ServerService.methods.listServers, wrap(listServers));
	router.rpc(ServerService, ServerService.methods.trackServer, wrap(trackServer));
	router.rpc(ServerService, ServerService.methods.claimServer, wrap(claimServer));
	router.rpc(ServerService, ServerService.methods.listClaimedServers, wrap(listClaimedServers));
	router.rpc(ServerService, ServerService.methods.updateClaimedServer, wrap(updateClaimedServer));
	router.rpc(ServerService, ServerService.methods.unclaimServer, wrap(unclaimServer));
}
