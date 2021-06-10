import { Column, DataType, Default, HasMany, HasOne, Index, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';

import { GameServerPing } from './GameServerPing';

@Table
export class GameServer extends Model<GameServer> {
	@Unique
	@Default(DataType.UUIDV4)
	@Column(DataType.UUID)
	public id: string;

	@Column
	@Index
	public address: string;

	@PrimaryKey
	@Unique
	@Column
	public ip: string;

	@Column
	public port: number;

	@Column
	public sacnr: boolean;

	@Column
	public lastSuccessfulPing: Date;

	@Column
	public lastFailedPing: Date;

	@Column({
		defaultValue: false,
	})
	public supporter: boolean;

	// Assumed properties
	@Column
	public assumedIcon: string;

	@Column
	public assumedDiscordGuild: string;

	@Column(DataType.JSON)
	public assumedSocials: object;

	// Configurable Properties
	@Column
	public userDiscordGuild: string;

	@Column
	public userDiscordInvite: string;

	@Column
	public userIcon: string;

	@Column(DataType.JSON)
	public userSocials: object;

	@Column
	public lastPingId: string;

	@HasMany(() => GameServerPing, {
		foreignKey: 'address',
		sourceKey: 'address',
		as: 'ping',
		constraints: false,
	})
	public gameServer: GameServerPing;

	@HasOne(() => GameServerPing, {
		foreignKey: 'id',
		sourceKey: 'lastPingId',
		constraints: false,
		as: 'latestPing',
	})
	public latestPing: GameServerPing;
}
