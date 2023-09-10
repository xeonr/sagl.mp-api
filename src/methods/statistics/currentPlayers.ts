import { CurrentPlayersRequest, CurrentPlayersResponse } from '@buf/xeonr_sagl-servers.bufbuild_es/serversapi/v1/api_pb.js';
import { Server } from '../../models';

export async function currentPlayers(_: CurrentPlayersRequest): Promise<CurrentPlayersResponse> {
	const data = await Server.aggregate([{
		$group: {
			_id: '',
			maxPlayers: { $sum: '$maxPlayers' },
			onlinePlayers: { $sum: '$onlinePlayers' },
			avgPlayers: { $avg: '$onlinePlayers' },
		}
	}])

	return new CurrentPlayersResponse({
		averagePlayers: Math.round(data[0].avgPlayers),
		maxPlayers: data[0].maxPlayers,
		onlinePlayers: data[0].onlinePlayers,
		percentFull: Math.round(data[0].onlinePlayers / data[0].maxPlayers * 100),
	});
}