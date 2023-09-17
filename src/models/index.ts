import { Schema } from 'mongoose';
import { mongooseInstance } from '../util/Mongoose';

export interface IServer {
	address: string;
	asnId: number;
	asnName: string;
	city: string;
	country: string;
	firstSeenAt: string;
	gamemode: string;
	hosted: boolean;
	hostname: string;
	ip: string;
	ipLocation: {
		type: 'Point',
		coordinates: [number, number];
	} | null;
	language: string;
	lastOnlineAt: Date;
	lastUpdatedAt: Date;
	maxPlayers: number;
	online: boolean;
	onlinePlayers: number;
	openmp: boolean;
	origin: string;
	passworded: boolean;
	ping: number;
	players: Array<Object>;
	port: number;
	rules: { [key: string]: string };
	sacnr: boolean;
}

const serverSchema = new Schema({
	address: String,
	asnId: Number,
	asnName: String,
	city: String,
	country: String,
	firstSeenAt: String,
	gamemode: String,
	hosted: Boolean,
	hostname: String,
	ip: String,
	ipLocation: {
		lat: Number,
		lon: Number
	},
	language: String,
	lastOnlineAt: Date,
	lastUpdatedAt: Date,
	maxPlayers: Number,
	online: Boolean,
	onlinePLayers: Number,
	openmp: Boolean,
	origin: String,
	passworded: Boolean,
	ping: Number,
	players: Array<Object>,
	port: Number,
	rules: Object,
	sacnr: Boolean,

});

export const Server = mongooseInstance.model <IServer>('Server', serverSchema);


const gameServerPointerSchema = new Schema({
	address: String,
	ip: String,
	port: Number,
	sacnr: Boolean,
	openmp: Boolean,
});

export const GameServerPointer = mongooseInstance.model('GameServerPointer', gameServerPointerSchema);


const serverClaimSchema = new Schema({
	ip: String,
	port: Number,
	discordUsername: String,
	discordId: String,
	discordAvatar: String,
	saglId: String,
});

export const ServerClaim = mongooseInstance.model('ServerClaim', serverClaimSchema);


const serverConfigurationSchema = new Schema({
	ip: String,
	port: Number,

	icon: String,
	description: String,
	profile_icon: String,
	display_name: String,
	hostname: String,
	socials: Object,
	is_supporter: Boolean,
});

export const ServerConfiguration = mongooseInstance.model('ServerConfiguration', serverConfigurationSchema);
