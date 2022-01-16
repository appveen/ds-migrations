const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const log4js = require('log4js');
const { MongoClient } = require('mongodb');

const cryptUtils = require('../utils');


const MONGODB_AUTHOR_URL = process.env.MONGODB_AUTHOR_URL;
const CONFIG_DB = process.env.CONFIG_DB;
const PASSWORD = process.env.PASSWORD;


log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('01-encrypt-using-password');


async function execute() {
    let client;
    try {
        client = await MongoClient.connect(MONGODB_AUTHOR_URL, global.mongoConfig);
        const keysCol = client.db(CONFIG_DB).collection('sec.encr');
        const decryptedKeys = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'keys.json')));
        let promises = decryptedKeys.map(async (item) => {
            try {
                item.certificate = cryptUtils.encrypt(item.certificate, PASSWORD);
                item.key = cryptUtils.encrypt(item.key, PASSWORD);
                const status = await keysCol.findOneAndUpdate({ _id: item._id }, { $set: item });
                console.log(status);
                return status;
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