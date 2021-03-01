
const mongodb = require("mongodb")
const config = require("./config")
const log4js = require("log4js")

log4js.configure(config.logging.options)
let version = require("./package.json").version
let logger = log4js.getLogger(`[data.stack Migration ${version}]`)
logger.level = config.logging.loglevel
global.logger = logger

const client = new mongodb.MongoClient(config.MONGO_AUTHOR_URL, {
	readPreference: mongodb.ReadPreference.SECONDARY_PREFERRED,
	useUnifiedTopology: true
})

let db = null


async function fixUsers() {
	logger.info(`Calling fixUsers()`)
	const userCollection = db.collection("userMgmt.users")
	return await userCollection.find({})
		.project({ "_id":1})
		.batchSize(10)
		.forEach(async (_d) => {
			logger.info(`Fixing authType ${_d._id}`)
			await userCollection.updateOne({ _id: _d._id }, { "$set": { "auth": {"authType": "local"} } })
		})
}


async function init() {
	try {
		await client.connect()
		db = client.db(config.MONGO_AUTHOR_DBNAME)
		logger.info(`Connected to DB :: ${config.MONGO_AUTHOR_DBNAME}`)

		await fixUsers()

	} catch (_err) {
		console.log(_err.message)
	}
	// await client.close()
}

init()