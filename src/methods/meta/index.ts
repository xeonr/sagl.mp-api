import type { ConnectRouter } from "@connectrpc/connect";
import {MetaService} from '@buf/xeonr_sagl-servers.connectrpc_es/serversapi/v1/api_connect.js';

import { wrap } from '../../util/wrap.js';
import {startImageUpload} from "./startImageUpload.js";


export default function (router: ConnectRouter) {
	router.service(MetaService, {
		startImageUpload: wrap(startImageUpload),
	});
}
