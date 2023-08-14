const { execSync } = require('child_process');
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const { MongoClient } = require('mongodb');
const _ = require('lodash');

const cipherUtils = require('./cipher.utils');
const migrationUtils = require('./migration.utils');

const ODP_NAMESPACE = process.env.ODP_NAMESPACE || 'capiot';
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'exideDB';

const key = readFileSync(path.join(__dirname, 'exide.key'), 'utf-8');
const cert = readFileSync(path.join(__dirname, 'exide.crt'), 'utf-8');

execSync('mkdir -p keys');
execSync('mkdir -p scripts');

(async () => {
    let conn;
    try {
        conn = await MongoClient.connect(MONGODB_URL);
        // const docs = await conn.db(MONGODB_DATABASE).collection('sec.encr').find({}).toArray();
        // console.table(docs);
        // docs.reduce((prev, curr) => {
        //     curr.certificate = cipherUtils.odp.decrypt(curr.certificate, key);
        //     curr.key = cipherUtils.odp.decrypt(curr.key, key);
        //     writeFileSync(path.join(__dirname, 'keys', `${curr._id}.json`), JSON.stringify(curr));
        // });
        const serviceList = await conn.db(MONGODB_DATABASE).collection('services').find({}).toArray();
        const convertedList = serviceList.map((item) => {
            item.definition = migrationUtils.convertDefinition(item.definition);
            return item;
        });
        await convertedList.reduce(async (prev, curr) => {
            try {
                await prev;
                await conn.db(MONGODB_DATABASE).collection('services').findOneAndUpdate({ _id: curr._id }, { $set: curr });
            } catch (err) {
                console.log(err);
            }
        }, Promise.resolve());
        let counter = 0;
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
                    code.push('const MONGODB_URL = process.env.MONGO_AUTHOR_URL || \'mongodb://localhost:27017\';');

                    code.push('(async () => {');
                    code.push('    let conn;');
                    code.push('    try {');
                    code.push('        conn = await MongoClient.connect(MONGODB_URL);');
                    code.push(`        const collection = conn.db('${ODP_NAMESPACE + '-' + curr.app}').collection('${_.camelCase(curr.api)}');`);
                    code.push('        const docs = await collection.find({}).toArray();');
                    code.push('        await docs.reduce(async(prev, doc) => {');
                    code.push('           try {');
                    code = code.concat(generateMigrationCode(definition));
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
                    writeFileSync(path.join(__dirname, 'scripts', `${_.padStart(counter + '', 3, '0')}.${curr._id}.js`), code.join('\n'), 'utf8');
                } catch (error) {
                    console.log(error);
                }
            }
        });
    } catch (err) {
        console.log(err);
    } finally {
        conn.close();
    }
})();



function generateMigrationCode(definition, parentDef) {
    let code = [];
    if (definition && !_.isEmpty(definition)) {
        Object.keys(definition).forEach(key => {
            let def = definition[key];
            let dataPath = parentDef ? parentDef.dataPath + '.' + key : key;
            def.key = key;
            def.dataPath = dataPath;
            if (def.type == 'Object') {
                generateMigrationCode(def.definition, def);
            } else if (def.type == 'Array') {
                generateMigrationCode(def.definition._self.definition, def);
            } else {
                if (def.properties && def.properties.password) {
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