require('dotenv').config();
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const log4js = require('log4js');

const cryptUtils = require('./utils');

const PASSWORD = process.env.PASSWORD;


log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('01-encrypt-using-password');


async function encrypt() {
    try {
        const encryptedText = cryptUtils.encrypt("Hello World", PASSWORD)
        writeFileSync(path.join(process.cwd(), 'data', 'test.txt'), encryptedText);
    } catch (err) {
        logger.error(err);
        process.exit(0);
    }
}

async function decrypt() {
    try {
        const encryptedText = readFileSync(path.join(process.cwd(), 'data', 'test.txt'), 'utf-8');
        const decryptedText = cryptUtils.decrypt(encryptedText, PASSWORD)
        console.log(decryptedText);
    } catch (err) {
        logger.error(err);
        process.exit(0);
    }
}

// encrypt();
decrypt();