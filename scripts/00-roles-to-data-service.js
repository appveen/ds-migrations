const log4js = require('log4js');
const { MongoClient } = require('mongodb');


const MONGODB_AUTHOR_URL = process.env.MONGODB_AUTHOR_URL;
const CONFIG_DB = process.env.CONFIG_DB;

log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('00-roles-to-data-service');


async function execute() {
    let client;
    try {
        client = await MongoClient.connect(MONGODB_AUTHOR_URL, global.mongoConfig);
        const serviceCol = client.db(CONFIG_DB).collection('services');
        const roleCol = client.db(CONFIG_DB).collection('userMgmt.roles');

        let docs = await serviceCol.find({ 'role': { $exists: false } }).toArray();
        const ids = docs.map(e => e._id);
        let roles = await roleCol.find({ _id: { $in: ids } }).toArray();
        let promises = docs.map(async (doc) => {
            try {
                const role = roles.find(e => e._id === doc._id);
                if (role.fields && typeof role.fields == 'string') {
                    role.fields = JSON.parse(role.fields);
                }
                return await serviceCol.findOneAndUpdate({ _id: doc._id }, { $set: { role: role } });
            } catch (err) {
                logger.error(err);
            }
        });
        const status = await Promise.all(promises);
        console.log(status);
    } catch (err) {
        logger.error(err);
        process.exit(0);
    } finally {
        client.close();
    }
}

module.exports.execute = execute;