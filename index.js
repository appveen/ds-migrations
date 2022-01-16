require('dotenv').config();

(async function () {

    global.mongoConfig = {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        connectTimeoutMS: 120000
    };

    await require('./scripts/00-decrypt-using-keys').execute();
    console.log('Script-00 Finished');
    await require('./scripts/01-encrypt-using-password').execute();
    console.log('Script-01 Finished');
})();

