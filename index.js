require('dotenv').config();

(async function () {

    global.mongoConfig = {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        connectTimeoutMS: 120000
    };

    await require('./scripts/00-roles-to-data-service').execute();
    console.log('Script-00 Finished');
    await require('./scripts/01-review-to-workflow').execute();
    console.log('Script-01 Finished');
    await require('./scripts/02-skip-review-to-admin').execute();
    console.log('Script-02 Finished');
    await require('./scripts/03-workitems-patch').execute();
    console.log('Script-03 Finished');
})();

