const crypto = require('crypto');

const IV_LENGTH = 16;
const ALGORITHIM = 'aes-256-cbc';
const SECRET = '34857057658800771270426551038148';


function rand(index) {
    const i = Math.pow(10, index - 1);
    const j = Math.pow(10, index) - 1;
    return Math.floor(Math.random() * (j - i + 1)) + i;
}



function encrypt(text, key) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv(ALGORITHIM, Buffer.from(SECRET), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    let basepub = Buffer.from(key);
    let initializationVector = crypto.publicEncrypt(basepub, iv);
    return initializationVector.toString('hex') + ':' + encrypted.toString('hex');
};

function decrypt(text, key) {
    let textParts = text.split(':');
    let initializationVector = Buffer.from(textParts.shift(), 'hex');
    let iv = crypto.privateDecrypt(key, initializationVector);
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv(ALGORITHIM, Buffer.from(SECRET), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};


module.exports.rand = rand;
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;