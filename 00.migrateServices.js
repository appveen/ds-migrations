
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

var ProgressBar = require('progress');
var bar = new ProgressBar('[:bar] :current/:total :percent :elapsed', { total: 100, width: 100});

function convert(definition) {
    let defList = [];
    if (definition && typeof definition == 'string') {
        definition = JSON.parse(definition);
    }
    if (Array.isArray(definition)) {
        return definition;
    }
    Object.keys(definition).forEach(key => {
        const def = definition[key];
        def.key = key;
        if (def.type === 'Object' || def.type === 'Array') {
          def.definition = convert(def.definition);
        }
        if (def.type === 'Date') {
        	def.properties["defaultTimezone"] = "Zulu"
        	def.properties["supportedTimezones"] = []
        }
        defList.push(def);
    });
    if(defList[0].properties.dataKey == "_id") defList[0]["type"] = "String"
    return defList;
}

async function fixServicesDefinition() {
	logger.info(`Calling fixServicesDefinition()`)
	const serviceDB = db.collection("services")
	return await serviceDB.find({})
		.project({ "definition": 1, 'name':1, 'app':1})
		.sort({'app':1})
		.batchSize(10)
		.forEach(async (_d) => {
			logger.info(`Fixing definition ${_d.app}/${_d._id}/${_d.name}`)
			if(typeof _d.definition == 'string')
				await serviceDB.updateOne({ _id: _d._id }, { "$set": { "definition": convert(_d.definition) } })
		})
}

async function verifyServicesDefinition() {
	logger.info(`Calling verifyServicesDefinition()`)
	const serviceDB = db.collection("services")
	return await serviceDB.find({})
		.project({ "definition": 1, 'name':1, 'app':1})
		.sort({'app':1})
		.batchSize(10)
		.forEach(async (_d) => {
			if(Array.isArray(_d.definition)) logger.info(`Verifying definition ${_d.app}/${_d._id}/${_d.name} :: PASS`)
			else logger.error(`Verifying definition ${_d.app}/${_d._id}/${_d.name} :: FAIL`)
		})
}


async function stopAllService() {
	logger.info(`Calling stopAllService()`)
	const serviceDB = db.collection("services")
	return await serviceDB.find({})
		.project({ "status": 1, "app": 1, "name":1})
		.sort({'app':1})
		.batchSize(10)
		.forEach(async (_d) => {
			logger.info(`Stopping ${_d.app}/${_d._id}/${_d.name}`)
			await serviceDB.updateOne({ _id: _d._id }, { "$set": { "status": "Undeployed" } })
		})
}


async function init() {
	try {
		await client.connect()
		db = client.db(config.MONGO_AUTHOR_DBNAME)
		logger.info(`Connected to DB :: ${config.MONGO_AUTHOR_DBNAME}`)

		// await stopAllService()
		await fixServicesDefinition()
		await verifyServicesDefinition()

	} catch (_err) {
		console.log(_err.message)
	}
	// await client.close()
}

init()