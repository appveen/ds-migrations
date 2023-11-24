if (process.env.NODE_ENV != 'production') {
    require('dotenv').config();
}
const fs = require('fs');
const path = require('path');
const express = require('express');
const log4js = require('log4js');

const migrationUtils = require('./migration.utils');

const PORT = process.env.PORT || 3000;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const logger = log4js.getLogger('Server');
const app = express();

log4js.configure({
    appenders: { 'out': { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: LOG_LEVEL } }
});

try {
    if (process.env.NODE_ENV == 'production') {
        global.baseKey = fs.readFileSync('/opt/keys/odp.key', 'utf8');
        global.baseCert = fs.readFileSync('/opt/keys/odp.crt', 'utf8');
        global.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

        if (!global.ENCRYPTION_KEY) {
            throw new Error('Please provide ENCRYPTION_KEY as ENV Variable');
        }
        if (!global.baseKey || !global.baseCert) {
            throw new Error('Please mount odp-sec secret in the deployment yaml');
        }
    } else {
        global.baseKey = fs.readFileSync('./odp.key', 'utf8');
        global.baseCert = fs.readFileSync('./odp.crt', 'utf8');
        global.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    }
    migrationUtils.checkKeyAndCert(global.baseKey, global.baseCert);
} catch (err) {
    logger.error(err);
    process.exit(0);
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ inflate: true }));

app.use((req, res, next) => {
    logger.info(req.method, req.headers['x-forwarded-for'], req.path);
    next();
});

app.use('/api', require('./router'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, (err) => {
    if (!err) {
        logger.info('Server is listening on port', PORT);
    } else {
        logger.error(err);
    }
});