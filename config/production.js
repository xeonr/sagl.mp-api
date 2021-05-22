module.exports = {
	"db": {
		"database": process.env.MYSQL_DB_DB,
		"dialect": "mysql",
		"username": process.env.MYSQL_DB_USER,
		"password": process.env.MYSQL_DB_PASS,
	},
	"storage": {
		"bucket": "sagl-server-polls",
		"auth": undefined
	},
	"web": {
		"host": "0.0.0.0",
		"port": process.env.PORT,
	}
}
