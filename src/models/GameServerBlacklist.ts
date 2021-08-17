import { AutoIncrement, Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript';


@Table
export class GameServerBlacklist extends Model<GameServerBlacklist> {
	@PrimaryKey
	@AutoIncrement
	@Column
	public id: number;

	@Column
	@Index
	public address: string;

	@Column(DataType.DATE)
	public expiresAt: Date;

}
