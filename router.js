const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const log4js = require('log4js');
const { MongoClient } = require('mongodb');
const _ = require('lodash');

const migrationUtils = require('./migration.utils');
const cipherUtils = require('./cipher.utils');

const logger = log4js.getLogger('router');

const ODP_NAMESPACE = process.env.ODP_NAMESPACE || 'capiot';
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'odpConfig';

router.get('/migrate/securityKeys/log', async (req, res) => {
    res.sendFile(path.join(process.cwd(), 'logs', 'securityKeys.log'));
});
router.post('/migrate/securityKeys', async (req, res) => {
    try {
        fs.writeFileSync(path.join(process.cwd(), 'logs', 'securityKeys.log'), '');
        const secLogger = log4js.getLogger('securityKeys');
        let conn = await MongoClient.connect(MONGODB_URL);
        secLogger.info('Connected to DB')
        secLogger.info('Fetching keys from DB');
        const docs = await conn.db(MONGODB_DATABASE).collection('sec.encr').find({}).toArray();
        secLogger.info('keys found: ', docs.length);
        let result = [];
        await docs.reduce(async (prev, curr) => {
            try {
                secLogger.info('====================================================');
                secLogger.info('Running Migration for Document: ', curr._id, curr.app);
                secLogger.info('Trying to Decrypt Certificate');
                curr.certificate = cipherUtils.odp.decrypt(curr.certificate, global.baseKey);
                secLogger.info('Trying to Decrypt Key');
                curr.key = cipherUtils.odp.decrypt(curr.key, global.baseKey);
                secLogger.info('Storing Key in File: ' + `${curr._id}.json`);
                writeFileSync(path.join(__dirname, 'keys', `${curr._id}.json`), JSON.stringify(curr));
                secLogger.info('Trying to Encrypt Certificate Using ENCRYPTION_KEY');
                curr.certificate = cipherUtils.datastack.encrypt(curr.certificate, global.ENCRYPTION_KEY);
                secLogger.info('Trying to Encrypt Key Using ENCRYPTION_KEY');
                curr.key = cipherUtils.datastack.encrypt(curr.key, global.ENCRYPTION_KEY);
                secLogger.info('Trying to Update Key & Cert in DB');
                let status = await conn.db(MONGODB_DATABASE).collection('sec.encr').findOneAndUpdate({ _id: curr._id }, { $set: curr });
                secLogger.info(`Migration of ${curr._id} Complete!`);
                result.push({ _id: curr._id, status: 200, data: status });
            } catch (err) {
                logger.error(err);
                secLogger.error('Error Occured for ', curr._id, curr.app);
                secLogger.error(err);
                secLogger.error(`Migration of ${curr._id} Failed!`);
                result.push({ _id: curr._id, status: 500, data: err });
            }
        });
        if (result.every(e => e.status == 200)) {
            res.status(200).json({ message: 'All Data Converted' });
        } else if (result.every(e => e.status == 500)) {
            res.status(500).json({ message: 'No Data Converted' });
        } else {
            res.status(204).json({ message: 'Some Data Converted' });
        }
    } catch (err) {
        logger.error(err);
        if (typeof err === 'string') {
            return res.status(500).json({
                message: err
            });
        }
        res.status(500).json({
            message: err.message
        });
    }
});

router.post('/migrate/dataService', async (req, res) => {
    try {
        let conn = await MongoClient.connect(MONGODB_URL);
        const serviceList = await conn.db(MONGODB_DATABASE).collection('services').find({}).toArray();
        const convertedList = serviceList.map((item) => {
            item.definition = migrationUtils.convertDefinition(item.definition);
            migrationUtils.enrichSchema(item);
            return item;
        });
        await convertedList.reduce(async (prev, curr) => {
            try {
                await prev;
                await conn.db(MONGODB_DATABASE).collection('services').findOneAndUpdate({ _id: curr._id }, { $set: curr });
            } catch (err) {
                logger.error(err);
            }
        }, Promise.resolve());
        res.status(200).json({ message: 'All Data Converted' });
    } catch (err) {
        logger.error(err);
        if (typeof err === 'string') {
            return res.status(500).json({
                message: err
            });
        }
        res.status(500).json({
            message: err.message
        });
    }
});

router.post('/migrate/libraries', async (req, res) => {
    try {
        let conn = await MongoClient.connect(MONGODB_URL);
        const serviceList = await conn.db(MONGODB_DATABASE).collection('globalSchema').find({}).toArray();
        const convertedList = serviceList.map((item) => {
            item.definition = migrationUtils.convertDefinition(item.definition);
            return item;
        });
        await convertedList.reduce(async (prev, curr) => {
            try {
                await prev;
                await conn.db(MONGODB_DATABASE).collection('globalSchema').findOneAndUpdate({ _id: curr._id }, { $set: curr });
            } catch (err) {
                logger.error(err);
            }
        }, Promise.resolve());
        res.status(200).json({ message: 'All Data Converted' });
    } catch (err) {
        logger.error(err);
        if (typeof err === 'string') {
            return res.status(500).json({
                message: err
            });
        }
        res.status(500).json({
            message: err.message
        });
    }
});

module.exports = router;