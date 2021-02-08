const path = require('path');
const express = require('express');
const log4js = require('log4js');

const definitionLib = require('./lib/definition.lib');

const PORT = process.env.PORT || 3000;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const BASE_PATH = process.env.BASE_PATH || '/tools/';

const logger = log4js.getLogger('Server');
const app = express();
const router = express.Router();


log4js.configure({
    appenders: { 'out': { type: 'stdout' }, server: { type: 'multiFile', base: 'logs/', property: 'categoryName', extension: '.log', maxLogSize: 10485760, backups: 3, compress: true } },
    categories: { default: { appenders: ['out'], level: LOG_LEVEL } }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.set('view engine', 'ejs');

app.use((req, res, next) => {
    logger.info(req.method, req.headers['x-forwarded-for'] || req.connection.remoteAddress, req.path);
    res.locals.basePath = BASE_PATH;
    next();
});

app.use(BASE_PATH, router);

app.get('/', (req, res) => {
    res.redirect(BASE_PATH);
});

router.get('/', (req, res) => {
    res.render('index');
});

router.post('/schema', (req, res) => {
    let defList = [];
    const payload = req.body;
    let oldDefinition;
    if (payload.oldSchema && typeof payload.oldSchema == 'string') {
        payload.oldSchema = JSON.parse(payload.oldSchema);
    }
    if (payload.oldSchema) {
        if (payload.oldSchema.name) {
            delete payload.oldSchema._metadata;
            delete payload.oldSchema.attributeList;
            delete payload.oldSchema.role;
            oldDefinition = payload.oldSchema.definition;
        } else {
            oldDefinition = payload.oldSchema;
        }
    }
    if (oldDefinition) {
        defList = definitionLib.convert(oldDefinition);
    }
    if (payload.oldSchema) {
        if (payload.oldSchema.name) {
            payload.oldSchema.definition = defList;
        } else {
            payload.oldSchema = defList;
        }
    }
    res.render('index', { oldSchema: payload.oldSchema, newSchema: payload.oldSchema });
});

app.listen(PORT, (err) => {
    if (!err) {
        logger.info('Server is listening on port', PORT);
    } else {
        logger.error(err);
    }
});