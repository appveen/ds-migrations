
const mongodb = require("mongodb")
const moment = require('moment-timezone');
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

var ProgressBar = require('progress')

let serviceList = {}

let dataStackNamespace = process.env.DATA_STACK_NAMESPACE || "appveen"

function searchForDate(_id, _parent, _definition) {
	let list = [] 
	try {
	  _definition.forEach(field => {
	    if (field.type === 'Object' || field.type === 'Array') {
	      list = list.concat(searchForDate(_id, `${_parent}${field.key}.`, field.definition))
	    }
	    if (field.type === 'Date') {
	    	list.push(`${_parent}${field.key}`)
	    }
	  })
	} catch (e) {
		logger.error(`${_id} :: Unable to parse definition`)
	}
  return list
}

async function findServicesWithDate() {
	logger.info(`Calling fixServicesDefinition()`)
	const serviceCollection = db.collection("services")
	return await serviceCollection.find({})
		.project({ "definition": 1, 'name':1, 'app':1})
		.sort({'app':1})
		.batchSize(10)
		.forEach(async (_d) => {
			logger.info(`${_d.app}/${_d._id}/${_d.name}`)
			let fields = searchForDate(_d._id, "", _d.definition)
			if(fields.length) {
				logger.info(`${_d.app}/${_d._id}/${_d.name} :: ${fields}`)
				if(!serviceList[_d.app]) serviceList[_d.app] = {}
				serviceList[_d.app][_d._id] = fields
			}
		})
}

function formatDate(_app, _serviceId, _id, rawData, tzInfo, isUnix) {
	try {
		let parsedDate = new Date(rawData);
		if (!tzInfo) tzInfo = global.defaultTimezone;
		let dt = moment(parsedDate.toISOString());
		return {
			rawData: rawData.toString(),
			tzData: dt.tz(tzInfo).format(),
			tzInfo: tzInfo,
			utc: dt.toISOString(),
			unix: isUnix ? rawData : Date.parse(rawData)
		};
	} catch (e) {
		logger.error(`Invalid data in formatDate :: ${_app} ${_serviceId} ${_id} :: ${rawData} ${tzInfo} ${isUnix}`);
	}
}

async function __fixDateInService(_app, _collectionName, _serviceId){
	logger.debug(`Calling __fixDateInService() :: ${_app}, ${_collectionName}, ${_serviceId}`)
	const appDB = client.db(`${dataStackNamespace}-${_app}`)
	logger.info(`Connected to DB :: ${dataStackNamespace}-${_app}`)
	const dataServiceCollection = appDB.collection(_collectionName)
	let projection = {}
	serviceList[_app][_serviceId].forEach(_attr => projection[_attr] = 1)
	logger.info(`Projection :: ${JSON.stringify(projection)}`)
	const count = await dataServiceCollection.countDocuments({})
	logger.info(`Found ${count} documents to fix!`)
	var bar = new ProgressBar('[:bar] :current/:total :percent :elapsed', { total: count, width: 100})
	return await dataServiceCollection.find({})
	.project(projection)
	.batchSize(10)
	.forEach(async (_d) => {
		serviceList[_app][_serviceId].forEach(_attr => {
			if(_d[_attr] instanceof Date) _d[_attr] = formatDate(_app, _serviceId, _d._id, _d[_attr], "Zulu", false)
		})
		bar.tick()
		await dataServiceCollection.updateOne({ _id: _d._id }, { "$set": _d })
	})
}

async function __fixDateInApp(_app){
	logger.debug(`Calling __fixDateInApp() :: ${_app}`)
	const serviceCollection = db.collection("services")
	return Object.keys(serviceList[_app]).reduce(async (_prevService, _serviceId) => {
		await _prevService
		let service = await serviceCollection.findOne({_id: _serviceId}, {"projection": { "collectionName" : 1, "name" : 1}})
		let collectionName = service.collectionName
		logger.info(`${_app} :: ${_serviceId} :: ${service.name}`)
		await __fixDateInService(_app, collectionName, _serviceId)
	}, Promise.resolve())
}

async function fixDate() {
	logger.info(`Calling fixDate()`)
	await Object.keys(serviceList).reduce(async (_prevApp, _app) => {
		await _prevApp
		await __fixDateInApp(_app)
	}, Promise.resolve())
}

async function init() {
	try {
		await client.connect()
		db = client.db(config.MONGO_AUTHOR_DBNAME)
		logger.info(`Connected to DB :: ${config.MONGO_AUTHOR_DBNAME}`)

		await findServicesWithDate()
		logger.info(JSON.stringify(serviceList))
		await fixDate()
	} catch (_err) {
		console.log(_err.message)
	}
	await client.close()
}

init()