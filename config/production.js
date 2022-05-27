module.exports = {
	"db": {
		"database": process.env.MYSQL_DB_DB,
		"dialect": "mysql",
		"username": process.env.MYSQL_DB_USER,
		"password": process.env.MYSQL_DB_PASS,
		"host": process.env.MYSQL_DB_HOST,
	},
	"redis": {
		"host": process.env.REDIS_HOST,
		"keyPrefix": "saglServer:",
		"port": process.env.REDIS_PORT,
		"password": process.env.REDIS_PASS
	},
	"influxdb": {
		"url": "http://infra.lon1.xeonr.io:8086",
		"token": process.env.INFLUXDB_TOKEN,
		"bucket": "sagl-servers-prod",
		"org": "SA:GL",
	},
	"discord": {
		"key": process.env.DISCORD_TOKEN
	},
	"storage": {
		"bucket": "sagl-server-polls",
		"auth": undefined
	},
	"web": {
		"publicUrl": "https://server-api.sagl.app",
		"host": "0.0.0.0",
		"port": process.env.PORT,
	},
	"elasticsearch": {
		"url": process.env.ELASTICSEARCH_URL,
		"index": process.env.ELASTICSEARCH_INDEX,
		"username": process.env.ELASTICSEARCH_USERNAME,
		"password": process.env.ELASTICSEARCH_PASSWORD,
	}
}
