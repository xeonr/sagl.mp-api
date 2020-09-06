import { Sequelize } from 'sequelize-typescript';

export const db = new Sequelize({
	database: 'some_db',
	dialect: 'sqlite',
	username: 'root',
	password: '',
	storage: './sql.db',
	models: [`${__dirname}/../models`],
}); // tslint:disable-line
