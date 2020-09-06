import { Column, IsUUID, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';
import { v4 } from 'uuid';

@Table
export class GameServer extends Model<GameServer> {
	@IsUUID(4)
	@Column
	public id: string = v4();

	@PrimaryKey
	@Unique
	@Column
	public ip: string;

	@Column
	public address: string;

	@Column
	public port: number;

	@Column
	public lastSuccessfulPing: Date;

	@Column
	public lastFailedPing: Date;
}
