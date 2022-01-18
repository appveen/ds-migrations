const crypto = require('crypto');

const IV_LENGTH = 16;
const ALGORITHIM = 'aes-256-cbc';
const SECRET = '34857057658800771270426551038148';


function rand(index) {
    const i = Math.pow(10, index - 1);
    const j = Math.pow(10, index) - 1;
    return Math.floor(Math.random() * (j - i + 1)) + i;
}



function encryptUsingPublicKey(text, key) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv(ALGORITHIM, Buffer.from(SECRET), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    let basepub = Buffer.from(key);
    let initializationVector = crypto.publicEncrypt(basepub, iv);
    return initializationVector.toString('hex') + ':' + encrypted.toString('hex');
};

function decryptUsingPrivateKey(text, key) {
    let textParts = text.split(':');
    let initializationVector = Buffer.from(textParts.shift(), 'hex');
    let iv = crypto.privateDecrypt(key, initializationVector);
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv(ALGORITHIM, Buffer.from(SECRET), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

function encrypt(plainText, secret) {
    const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substring(0, 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHIM, key, iv);
    let cipherText;
    try {
        cipherText = cipher.update(plainText, 'utf8', 'hex');
        cipherText += cipher.final('hex');
        cipherText = iv.toString('hex') + ':' + cipherText
    } catch (e) {
        cipherText = null;
    }
    return cipherText;
}


function decrypt(cipherText, secret) {
    const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substring(0, 32);
    const iv = Buffer.from(cipherText.split(':')[0], 'hex');
    const textBytes = cipherText.split(':')[1];
    const decipher = crypto.createDecipheriv(ALGORITHIM, key, iv);
    let decrypted = decipher.update(textBytes, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}


module.exports.rand = rand;
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;
module.exports.encryptUsingPublicKey = encryptUsingPublicKey;
module.exports.decryptUsingPrivateKey = decryptUsingPrivateKey;