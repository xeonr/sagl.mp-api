import config from '@majesticfudgie/vault-config';
import { Sequelize } from 'sequelize-typescript';

import { GameServerBlacklist } from '../models/GameServerBlacklist';
import { GameServerHostname } from '../models/GameServerHostname';
import { GameServerPing } from '../models/GameServerPing';
import { GameServer } from './../models/GameServer';

export const db = new Sequelize({
	...config.get('db'),
}); // tslint:disable-line

db.addModels([GameServer, GameServerBlacklist, GameServerPing, GameServerHostname]);
