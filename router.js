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
// const DATA_STACK_NAMESPACE = process.env.DATA_STACK_NAMESPACE || 'appveen';
const MONGODB_URL = process.env.MONGO_AUTHOR_URL || 'mongodb://localhost:27017';
const MONGODB_DATABASE = process.env.MONGO_AUTHOR_DBNAME || 'odpConfig';

let SECURE_DS_LIST = [];

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
                fs.writeFileSync(path.join(__dirname, 'keys', `${curr._id}.json`), JSON.stringify(curr));
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

router.get('/migrate/dataService/log', async (req, res) => {
    res.sendFile(path.join(process.cwd(), 'logs', 'dataService.log'));
});
router.post('/migrate/dataService', async (req, res) => {
    let result = [];
    try {
        fs.writeFileSync(path.join(process.cwd(), 'logs', 'dataService.log'), '');
        const dsLogger = log4js.getLogger('dataService');
        let conn = await MongoClient.connect(MONGODB_URL);
        dsLogger.info('Connected to DB')
        dsLogger.info('Fetching Data Services from DB');
        const serviceList = await conn.db(MONGODB_DATABASE).collection('services').find({}).toArray();
        dsLogger.info('Data Services found: ', serviceList.length);
        dsLogger.info('====================================================');
        await serviceList.reduce(async (prev, curr) => {
            try {
                await prev;
                dsLogger.info('====================================================');
                dsLogger.info('Running Migration for Document: ', curr._id, curr.app);
                let temp = JSON.parse(JSON.stringify(curr));
                dsLogger.info('Trying to Convert the Definition');
                temp.definition = migrationUtils.convertDefinition(temp.definition);
                dsLogger.info('Trying to Set Default Values of new Features');
                migrationUtils.enrichSchema(temp);
                dsLogger.info(`Fetching Roles of service: ${temp._id}`);
                let role = await conn.db(MONGODB_DATABASE).collection('userMgmt.roles').findOne({ _id: temp._id });
                if (role) {
                    dsLogger.info('Copying Roles to Data Service:', temp._id);
                    role.roles.forEach(item => {
                        if (item.fields && typeof item.fields == 'string') {
                            item.fields = JSON.parse(item.fields);
                        }
                    });
                    if (role.fields && typeof role.fields == 'string') {
                        role.fields = JSON.parse(role.fields);
                    }
                    delete role._id;
                    delete role._metadata;
                    delete role.__v;
                    temp.role = role;
                } else {
                    dsLogger.info('Roles Not Found for Data Service:', temp._id);
                }
                dsLogger.info('Updating Document in DB');
                let status = await conn.db(MONGODB_DATABASE).collection('services').findOneAndUpdate({ _id: temp._id }, { $set: temp });
                result.push({ _id: temp._id, status: 200, data: status });
                dsLogger.info(`Migration of ${temp._id} Complete!`);
            } catch (err) {
                dsLogger.error('Error Occured for ', curr._id, curr.app);
                dsLogger.error(err);
                dsLogger.error(`Migration of ${curr._id} Failed!`);
                result.push({ _id: curr._id, status: 500, data: err });
            }
        }, Promise.resolve());
        let counter = 0;
        dsLogger.info('Generating Code to migrate secure text');
        serviceList.reduce((prev, curr) => {
            if (curr.definition) {
                try {
                    const definition = JSON.parse(curr.definition);
                    counter++;
                    let code = [];
                    code.push('const { join } = require(\'path\');');
                    code.push('const { readFileSync, writeFileSync } = require(\'fs\');');
                    code.push('const { MongoClient } = require(\'mongodb\');');
                    code.push('const _ = require(\'lodash\');');
                    code.push('const cipherUtils = require(\'../cipher.utils\');');
                    code.push('');
                    code.push('const ODP_NAMESPACE = process.env.ODP_NAMESPACE || \'capiot\';');
                    code.push('const MONGODB_URL = process.env.MONGO_AUTHOR_URL || \'mongodb://localhost:27017\';');
                    code.push('');
                    code.push('(async () => {');
                    code.push('    let conn;');
                    code.push('    try {');
                    code.push('        conn = await MongoClient.connect(MONGODB_URL);');
                    code.push(`        const collection = conn.db('${ODP_NAMESPACE + '-' + curr.app}').collection('${_.camelCase(curr.api)}');`);
                    code.push('        const docs = await collection.find({}).toArray();');
                    code.push('        await docs.reduce(async(prev, doc) => {');
                    code.push('           try {');
                    code = code.concat(generateMigrationCode(curr, definition));
                    code.push('           } catch(err) {');
                    code.push('              console.log(err);');
                    code.push('           }');
                    code.push('        });');
                    code.push('    } catch (err) {');
                    code.push('        console.log(err);');
                    code.push('    } finally {');
                    code.push('        conn.close();');
                    code.push('    }');
                    code.push('})();');
                    if (SECURE_DS_LIST.indexOf(curr._id) > -1) {
                        dsLogger.info('Code Genrated for secure text migration of :', curr._id);
                        fs.writeFileSync(path.join(__dirname, 'scripts', `${_.padStart(counter + '', 3, '0')}.${curr._id}.js`), code.join('\n'), 'utf8');
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        });
        if (SECURE_DS_LIST.length == 0) {
            dsLogger.info('No Secure Text Found in any Data Service');
        }
        dsLogger.info('====================================================');
        dsLogger.info('Trying to migrate Workflows');
        await migrateWorkflow();
        dsLogger.info('Done!');
        dsLogger.info('====================================================');
        dsLogger.info('Trying to migrate Skip Review Role');
        await migrateSkipReviewRole();
        dsLogger.info('Done!');
        dsLogger.info('====================================================');
        dsLogger.info('All Data Migrated');
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

function generateMigrationCode(schema, definition, parentDef) {
    let code = [];
    if (definition && !_.isEmpty(definition)) {
        Object.keys(definition).forEach(key => {
            let def = definition[key];
            let dataPath = parentDef ? parentDef.dataPath + '.' + key : key;
            def.key = key;
            def.dataPath = dataPath;
            if (def.type == 'Object') {
                generateMigrationCode(schema, def.definition, def);
            } else if (def.type == 'Array') {
                generateMigrationCode(schema, def.definition._self.definition, def);
            } else {
                if (def.properties && def.properties.password) {
                    SECURE_DS_LIST.push(schema._id);
                    SECURE_DS_LIST = _.uniq(SECURE_DS_LIST);
                    code.push(`let var_${_.camelCase(def.dataPath)} = _.get(doc, ${def.dataPath});`);
                    code.push(`var_${_.camelCase(def.dataPath)}.value = cipherUtils.odp.decrypt(var_${_.camelCase(def.dataPath)}.value, key);`);
                    code.push(`var_${_.camelCase(def.dataPath)}.value = cipherUtils.datastack.encrypt(var_${_.camelCase(def.dataPath)}.value, ENCRYPTION_KEY);`);
                    code.push(`_.set(doc, ${def.dataPath}, var_${_.camelCase(def.dataPath)});`);
                    code.push(`await collection.findOneAndUpdate({ _id: doc._id }, { $set: doc });`);
                }
            }
        });
    }
    return code;
}


async function migrateWorkflow() {
    let client;
    let permissionIds = {};
    let oldPermissionIds = [];
    try {
        fs.writeFileSync(path.join(process.cwd(), 'logs', 'workflow.log'), '');
        const wfLogger = log4js.getLogger('workflow');
        client = await MongoClient.connect(MONGODB_URL);
        const serviceCol = client.db(MONGODB_DATABASE).collection('services');
        const groupCol = client.db(MONGODB_DATABASE).collection('userMgmt.groups');
        wfLogger.info('Fetching Data Service that has Review Enabled');
        let docs = await serviceCol.find({ 'role.roles.operations.method': 'REVIEW' }).toArray();
        wfLogger.info('Data Service with Review found:', docs.length);
        let promises = docs.map(async (doc) => {
            wfLogger.info('Running migration for the data service with review:', doc._id);
            const mcId = 'C' + rand(10);
            permissionIds[doc._id] = { newId: mcId, oldIds: [] };
            try {
                const roleIndexes = doc.role.roles.map((e, i) => {
                    if (e.operations.find(eo => eo.method === 'REVIEW')) {
                        permissionIds[doc._id].oldIds.push(e.id);
                        oldPermissionIds.push(e.id);
                        return i;
                    }
                }).filter(e => typeof e === 'number');
                roleIndexes.reduce((prev, curr) => {
                    const role = doc.role.roles[curr];
                    role.operations = role.operations.filter(e => e.method !== 'REVIEW');
                }, null);
                wfLogger.info('Adding Workflow Configuration Data Service:', doc._id);
                doc.workflowConfig = {
                    enabled: true,
                    makerCheckers: [
                        {
                            name: doc.name + ' Maker Checker',
                            steps: [
                                { id: mcId, name: 'Reviewer', approvals: 1 }
                            ]
                        }
                    ]
                }
                return await serviceCol.findOneAndUpdate({ _id: doc._id }, { $set: { workflowConfig: doc.workflowConfig, role: doc.role } });
            } catch (err) {
                wfLogger.error(err);
            }
        });
        await Promise.all(promises);

        fs.writeFileSync(path.join(__dirname, 'data', 'WF_PERMISSION_ID.json'), JSON.stringify(permissionIds));

        docs = await groupCol.find({ 'roles.id': { $in: oldPermissionIds } }).toArray();
        promises = docs.map(async (doc) => {
            try {
                const newRoles = doc.roles.reduce((prev, curr) => {
                    const perms = permissionIds[curr.entity];
                    if (perms && perms.oldIds.indexOf(curr.id) > -1 && prev.findIndex(e => e.id == perms.newId) == -1) {
                        const temp = JSON.parse(JSON.stringify(curr));
                        temp.id = perms.newId;
                        prev.push(temp);
                    }
                    return prev;
                }, JSON.parse(JSON.stringify(doc.roles)));
                return await groupCol.findOneAndUpdate({ _id: doc._id }, { $set: { roles: newRoles } });
            } catch (err) {
                wfLogger.error(err);
            }
        });
        await Promise.all(promises);
    } catch (err) {
        logger.error(err);
    }
}


async function migrateSkipReviewRole() {
    let client;
    let permissionIds = {};
    let oldPermissionIds = [];
    try {
        client = await MongoClient.connect(MONGODB_URL);
        const serviceCol = client.db(MONGODB_DATABASE).collection('services');
        const groupCol = client.db(MONGODB_DATABASE).collection('userMgmt.groups');

        let docs = await serviceCol.find({ 'role.roles.operations.method': 'SKIP_REVIEW' }).toArray();
        let promises = docs.map(async (doc) => {
            const adminId = 'ADMIN_' + doc._id;
            permissionIds[doc._id] = { newId: adminId, oldIds: [] };
            try {
                const roleIndexes = doc.role.roles.map((e, i) => {
                    if (e.operations.find(eo => eo.method === 'SKIP_REVIEW')) {
                        permissionIds[doc._id].oldIds.push(e.id);
                        oldPermissionIds.push(e.id);
                        return i;
                    }
                }).filter(e => typeof e === 'number');
                roleIndexes.reverse().forEach(index => {
                    doc.role.roles.splice(index, 1);
                });
                return await serviceCol.findOneAndUpdate({ _id: doc._id }, { $set: { role: doc.role } });
            } catch (err) {
                logger.error(err);
            }
        });
        await Promise.all(promises);

        fs.writeFileSync(path.join(__dirname, 'data', 'skip-review-permission-id.json'), JSON.stringify(permissionIds));

        docs = await groupCol.find({ 'roles.id': { $in: oldPermissionIds } }).toArray();
        fs.writeFileSync(path.join(__dirname, 'data', 'skip-review-permission-id-groups.json'), JSON.stringify(docs.map(e => e._id)));
        promises = docs.map(async (doc) => {
            try {
                const newRoles = doc.roles.reduce((prev, curr) => {
                    const perms = permissionIds[curr.entity];
                    if (perms && perms.oldIds.indexOf(curr.id) > -1 && prev.findIndex(e => e.id == perms.newId) == -1) {
                        const temp = JSON.parse(JSON.stringify(curr));
                        temp.id = perms.newId;
                        prev.push(temp);
                    }
                    return prev;
                }, JSON.parse(JSON.stringify(doc.roles)));
                return await groupCol.findOneAndUpdate({ _id: doc._id }, { $set: { roles: newRoles } });
            } catch (err) {
                logger.error(err);
            }
        });
        await Promise.all(promises);
    } catch (err) {
        logger.error(err);
    }
}

function rand(index) {
    const i = Math.pow(10, index - 1);
    const j = Math.pow(10, index) - 1;
    return Math.floor(Math.random() * (j - i + 1)) + i;
}

module.exports = router;