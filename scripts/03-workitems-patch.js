const log4js = require('log4js');
const { MongoClient } = require('mongodb');


const MONGODB_URL = process.env.MONGODB_URL;
const CONFIG_DB = process.env.CONFIG_DB;
const NAMESPACE = process.env.NAMESPACE;

log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('03-workitems-patch');


async function execute() {
    let client;
    try {
        client = await MongoClient.connect(MONGODB_URL, global.mongoConfig);
        const serviceCol = client.db(CONFIG_DB).collection('services');

        let services = await serviceCol.find({ 'workflowConfig.enabled': true }).toArray();
        let promises = services.map(async (doc) => {
            try {
                const workflowCol = client.db(`${NAMESPACE}-${doc.app}`).collection(`${doc.collectionName}.workflow`);
                const stats = await workflowCol.updateMany({}, { $set: { checkerStep: 'Reviewer' } });
                console.log(stats);
                const docs = await workflowCol.find({ 'audit.action': 'Approved' }).toArray();
                const results = [];
                await docs.reduce(async (prev, doc) => {
                    await prev;
                    doc.audit = doc.audit.map(e => {
                        if (e.action === 'Approved') {
                            e.action = 'Reviewer';
                        }
                        return e;
                    });
                    const res = await workflowCol.updateOne({ _id: doc._id }, { $set: { audit: doc.audit } });
                    results.push(res);
                    return res;
                }, Promise.resolve());
            } catch (err) {
                logger.error(err);
            }
        });
        await Promise.all(promises);
    } catch (err) {
        logger.error(err);
        process.exit(0);
    } finally {
        client.close();
    }
}

module.exports.execute = execute;