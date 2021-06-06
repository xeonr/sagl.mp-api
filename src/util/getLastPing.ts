import { GameServerPing } from './../models/GameServerPing';
export async function getLastPing(): Promise<Date> {
	const gamePing = await GameServerPing.findOne({ order: [['batchPingedAt', 'desc']], attributes: ['batchPingedAt'], limit: 1 });

	if (gamePing) {
		return gamePing.batchPingedAt;
	}

	throw new Error('Unable to find last ping');
}
