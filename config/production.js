module.exports = {
	"db": {
		"database": "vault:sagl/database/mysql-stats.databases.serverApi",
		"dialect": "mysql",
		"username": "vault:sagl/database/mysql-stats.username",
		"password": "vault:sagl/database/mysql-stats.password",
		"host": "vault:sagl/database/mysql-stats.host",
	},
	"redis": {
		"host": "vault:sagl/database/redis.host",
		"keyPrefix": "saglServer:",
		"port": "vault:sagl/database/redis.port",
		"password": "vault:sagl/database/redis.password",
	},
	"influxdb": {
		"url": "vault:sagl/database/influxdb.url",
		"token": "vault:sagl/database/influxdb.token",
		"bucket": "sagl-servers-prod",
		"org": "SA:GL",
	},
	"discord": {
		"key": "vault:sagl/server-api.discord.token"
	},
	"storage": {
		"bucket": "sagl-server-polls",
		"auth": "vault:sagl/server-api.gcs",
	},
	"web": {
		"publicUrl": "https://server-api.sagl.app",
		"host": "0.0.0.0",
		"port": 8080,
	},
	"elasticsearch": {
		"url": "vault:sagl/database/elastic.url",
		"index": "vault:sagl/database/elastic.index",
		"username": "vault:sagl/database/elastic.username",
		"password": "vault:sagl/database/elastic.password",
	}
}
