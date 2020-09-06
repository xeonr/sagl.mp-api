import { get } from 'config';
import { Sequelize } from 'sequelize-typescript';

export const db = new Sequelize({
	...get('db'),
	models: [`${__dirname}/../models`],
}); // tslint:disable-line
