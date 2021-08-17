import { Column, DataType, Default, HasMany, HasOne, Index, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';

import { GameServerPing } from './GameServerPing';

@Table
export class GameServerBlacklist extends Model<GameServerBlacklist> {
	@Unique
	@Default(DataType.UUIDV4)
	@Column(DataType.UUID)
	public id: string;

	@Column
	@Index
	public address: string;

	@Column(DataType.DATE)
	public expiresAt: Date;

}
