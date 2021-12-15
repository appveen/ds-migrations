const { writeFileSync } = require('fs');
const { join } = require('path');
const log4js = require('log4js');
const { MongoClient } = require('mongodb');

const { rand } = require('../utils');


const MONGODB_URL = process.env.MONGODB_URL;
const CONFIG_DB = process.env.CONFIG_DB;

log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('01-review-to-workflow');
const permissionIds = {};
const oldPermissionIds = [];


async function execute() {
    let client;
    try {
        client = await MongoClient.connect(MONGODB_URL, global.mongoConfig);
        const serviceCol = client.db(CONFIG_DB).collection('services');
        const groupCol = client.db(CONFIG_DB).collection('userMgmt.groups');
        // const roleCol = client.db(CONFIG_DB).collection('userMgmt.roles');

        let docs = await serviceCol.find({ 'role.roles.operations.method': 'REVIEW' }).toArray();
        let promises = docs.map(async (doc) => {
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
                logger.error(err);
            }
        });
        await Promise.all(promises);

        writeFileSync(join(__dirname, '../data/wf-permission-id.json'), JSON.stringify(permissionIds));

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