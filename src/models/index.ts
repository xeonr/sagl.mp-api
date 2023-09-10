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
	language: boolean;
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
	language: Boolean,
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

