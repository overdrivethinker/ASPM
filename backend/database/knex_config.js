require("dotenv").config({ path: __dirname + "/../.env" });

module.exports = {
	development: {
		client: process.env.DB_CLIENT,
		connection: {
			host: process.env.DB_HOST,
			port: parseInt(process.env.DB_PORT),
			user: process.env.DB_USER,
			password: process.env.DB_PASSWORD,
			database: process.env.DB_NAME,
			options: {
				encrypt: false,
				trustServerCertificate: true,
				enableArithAbort: true,
				instanceName: "",
			},
		},
		pool: {
			min: 2,
			max: 10,
		},
		migrations: {
			directory: "./migrations",
			tableName: "knex_migrations",
		},
		seeds: {
			directory: __dirname + "/seeds",
		},
	},
};
