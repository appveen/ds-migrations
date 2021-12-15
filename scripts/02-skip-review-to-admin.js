const { writeFileSync } = require('fs');
const { join } = require('path');
const log4js = require('log4js');
const { MongoClient } = require('mongodb');


const MONGODB_URL = process.env.MONGODB_URL;
const CONFIG_DB = process.env.CONFIG_DB;

log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('02-skip-review-to-admin');
const permissionIds = {};
const oldPermissionIds = [];


async function execute() {
    let client;
    try {
        client = await MongoClient.connect(MONGODB_URL, global.mongoConfig);
        const serviceCol = client.db(CONFIG_DB).collection('services');
        const groupCol = client.db(CONFIG_DB).collection('userMgmt.groups');
        // const roleCol = client.db(CONFIG_DB).collection('userMgmt.roles');

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

                // roleIndexes.reduce((prev, curr) => {
                //     const role = doc.role.roles[curr];
                //     role.name = role.name + ' [Deprecated]';
                //     role.operations = role.operations.filter(e => e.method !== 'SKIP_REVIEW');
                // }, null);
                return await serviceCol.findOneAndUpdate({ _id: doc._id }, { $set: { role: doc.role } });
            } catch (err) {
                logger.error(err);
            }
        });
        await Promise.all(promises);

        writeFileSync(join(__dirname, '../data/skip-review-permission-id.json'), JSON.stringify(permissionIds));

        docs = await groupCol.find({ 'roles.id': { $in: oldPermissionIds } }).toArray();
        writeFileSync(join(__dirname, '../data/skip-review-permission-id-groups.json'), JSON.stringify(docs.map(e => e._id)));
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