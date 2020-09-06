import { Column, DataType, Index, IsUUID, Model, PrimaryKey, Table } from 'sequelize-typescript';
import type { Json } from 'sequelize/types/lib/utils';
import { v4 } from 'uuid';

@Table
export class GameServerPing extends Model<GameServerPing> {
	@IsUUID(4)
	@PrimaryKey
	@Column
	public id: string = v4();

	@Index('servername')
	@Column
	public address: string;

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
	@Column(DataType.BOOLEAN)
	public maxPlayers: number;
	@Column(DataType.BOOLEAN)
	public onlinePlayers: number;
	@Column
	public ping: number;

	// Rules
	@Column(DataType.BOOLEAN)
	public lagcomp: boolean;
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
}
