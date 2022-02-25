import config from 'config';
import { Sequelize } from 'sequelize-typescript';

export const db = new Sequelize({
	...config.get('db'),
	models: [`${__dirname}/../models`],
}); // tslint:disable-line
