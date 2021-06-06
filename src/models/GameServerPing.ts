import { BelongsTo, Column, DataType, Default, Index, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';
import type { Json } from 'sequelize/types/lib/utils';

import { GameServer } from './GameServer';

@Table
export class GameServerPing extends Model<GameServerPing> {
	@Unique
	@PrimaryKey
	@Default(DataType.UUIDV4)
	@Column(DataType.UUID)
	public id: string;

	@Column
	@Index
	public address: string;

	@Index('servername')
	@Column
	public ip: string;

	@Index('servername')
	@Column
	public port: number;

	@Column(DataType.BOOLEAN)
	public online: boolean;
	@Column(DataType.BOOLEAN)
	public hosted: boolean;
	@Column
	public hostname: string;
	@Column
	public gamemode: string;
	@Column
	public language: string;
	@Column(DataType.BOOLEAN)
	public passworded: boolean;
	@Column
	public maxPlayers: number;
	@Column
	public onlinePlayers: number;
	@Column
	public ping: number;

	// Rules
	@Column
	public lagcomp: string;
	@Column
	public mapname: string;
	@Column
	public version: string;
	@Column
	public weather: string;
	@Column
	public weburl: string;
	@Column
	public worldtime: string;
	@Column
	public country: string;
	@Column
	public asn: string;
	@Column
	public asnName: string;

	@Column(DataType.JSON)
	public players: Json;

	@Column(DataType.DATE)
	public batchPingedAt: Date;

	@BelongsTo(() => GameServer, {
		foreignKey: 'address',
		targetKey: 'address',
		constraints: false,
	})
	public parent: GameServer;

	@BelongsTo(() => GameServer, {
		targetKey: 'lastPingId',
		foreignKey: 'id',
		constraints: false,
	})
	public latestPing: GameServer;
}
