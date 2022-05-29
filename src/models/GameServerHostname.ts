import { Column, DataType, Default, Index, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';

@Table
export class GameServerHostname extends Model<GameServerHostname> {
	@Unique
	@PrimaryKey
	@Default(DataType.UUIDV4)
	@Column(DataType.UUID)
	public id: string;

	@Column
	@Index
	public address: string;

	@Column
	public name: string;

	@Column
	public verificationValidAt: Date;

	@Column({
		type: DataType.DATE,
		defaultValue: null,
	})
	public verificationExpiredAt: Date = null;
}
