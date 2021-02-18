let d = new Date();
d = d.toISOString().replace(/:/gi, "-")
let fileName = `odpTodataStackMigration_${d}.log`

module.exports = {
	"MONGO_AUTHOR_URL": process.env.MONGO_AUTHOR_URL || "mongodb://localhost:27017",
	"MONGO_AUTHOR_DBNAME": process.env.MONGO_AUTHOR_DBNAME || "datastackConfig",
	"ODP_MONGO_AUTHOR_DBNAME": process.env.ODP_MONGO_AUTHOR_DBNAME || "odpConfig",
	"logging": {
		"loglevel": process.env.LOG_LEVEL || "info",
		"options": {
			"appenders": {
				"fileOut": {
					"type": 'file',
					"filename": fileName,
					"maxLogSize": 500000,
					"layout": { type: 'basic' }
				},
				"out": {
					"type": 'stdout',
					"layout": { type: 'basic' }
				}
			},
			"categories": {
				"default": {
					"appenders": ['out'],
					"level": 'error'
				}
			}
		}
	}
}