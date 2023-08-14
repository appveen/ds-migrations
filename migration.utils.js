const log4js = require('log4js');
const crypto = require('crypto');

const logger = log4js.getLogger('migration.utils');

function checkKeyAndCert(baseKey, baseCert) {
    const data = 'abcdefghijklmnopqrstuvwxyz1234567890';
    let buffer = Buffer.from(data);
    let decryptedData = '';
    let encryptedData = '';
    let publicKey = Buffer.from(baseCert);
    let privateKey = baseKey;
    try {
        encryptedData = crypto.publicEncrypt(publicKey, buffer);
    } catch (err) {
        logger.fatal('Incorrect Base public key');
        process.exit(1);
    }
    try {
        decryptedData = crypto.privateDecrypt(privateKey, encryptedData);
    } catch (err) {
        logger.fatal('Incorrect Base private key');
        process.exit(1);
    }
    if (decryptedData.toString() != data) {
        logger.fatal('Incorrect Base Public-Private Key Pair');
        process.exit(1);
    } else {
        logger.info('Public-Private Key Pair Valid');
    }
}


function convertDefinition(definition) {
    let defList = [];
    if (definition && typeof definition == 'string') {
        definition = JSON.parse(definition);
    }
    if (Array.isArray(definition)) {
        return definition;
    }
    if (!definition) {
        return defList;
    }
    Object.keys(definition).forEach(key => {
        const def = definition[key];
        def.key = key;
        if (def.type === 'Object' || def.type === 'Array') {
            def.definition = convertDefinition(def.definition);
        }
        if (def.type === 'Date') {
            def.properties["defaultTimezone"] = "Zulu"
            def.properties["supportedTimezones"] = []
        }
        defList.push(def);
    });
    return defList;
}


function enrichSchema(schema) {
    schema.schemaFree = false;
    schema.simpleDate = true;
    schema.stateModel = {
        attribute: "",
        initialStates: [],
        enabled: false
    };
    schema.workflowConfig = {
        enabled: false,
        makerCheckers: []
    };
}


module.exports = {
    checkKeyAndCert,
    convertDefinition,
    enrichSchema
}