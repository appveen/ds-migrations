const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const log4js = require('log4js');
const { MongoClient } = require('mongodb');

const cryptUtils = require('../utils');


const MONGODB_AUTHOR_URL = process.env.MONGODB_AUTHOR_URL;
const CONFIG_DB = process.env.CONFIG_DB;
let BASE_KEY = process.env.BASE_KEY;
let BASE_CERT = process.env.BASE_CERT;

BASE_KEY = readFileSync('/opt/keys/odp.key', 'utf8');
BASE_CERT = readFileSync('/opt/keys/odp.crt', 'utf8');

log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('00-decrypt-using-keys');


async function execute() {
    let client;
    try {
        client = await MongoClient.connect(MONGODB_AUTHOR_URL, global.mongoConfig);
        const keysCol = client.db(CONFIG_DB).collection('sec.encr');
        const keys = await keysCol.find({}).toArray();
        const decryptedKeys = [];
        keys.forEach(async (doc) => {
            try {
                doc.certificate = cryptUtils.decrypt(doc.certificate, BASE_KEY);
                doc.key = cryptUtils.decrypt(doc.key, BASE_KEY);
                decryptedKeys.push(doc);
            } catch (err) {
                logger.error(err);
            }
        });
        if (decryptedKeys.length !== keys.length) {
            throw new Error('Error Decrypting All Keys');
        }
        writeFileSync(path.join(process.cwd(), 'data', 'keys.json'), JSON.stringify(decryptedKeys));
    } catch (err) {
        logger.error(err);
        process.exit(0);
    } finally {
        client.close();
    }
}

module.exports.execute = execute;