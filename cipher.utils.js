const crypto = require('crypto');

const IV_LENGTH = 16;

module.exports = {
    odp: {
        decrypt: (text, key) => {
            let textParts = text.split(':');
            let initializationVector = Buffer.from(textParts[0], 'hex');
            let iv = crypto.privateDecrypt(key, initializationVector);
            let encryptedText = Buffer.from(textParts[1], 'hex');
            let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from('34857057658800771270426551038148'), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        },
        encrypt: (text, key) => {
            let iv = crypto.randomBytes(IV_LENGTH);
            let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from('34857057658800771270426551038148'), iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            let basepub = Buffer.from(key);
            let initializationVector = crypto.publicEncrypt(basepub, iv);
            return initializationVector.toString('hex') + ':' + encrypted.toString('hex');
        }
    },
    datastack: {
        encrypt: (plainText, secret) => {
            const key = crypto.createHash('sha256').update(secret).digest('base64').substring(0, 32);
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
            let cipherText;
            try {
                cipherText = cipher.update(plainText, 'utf8', 'hex');
                cipherText += cipher.final('hex');
                cipherText = iv.toString('hex') + ':' + cipherText;
            } catch (e) {
                cipherText = null;
            }
            return cipherText;
        },
        decrypt: (cipherText, secret) => {
            const key = crypto.createHash('sha256').update(secret).digest('base64').substring(0, 32);
            const iv = Buffer.from(cipherText.split(':')[0], 'hex');
            const textBytes = cipherText.split(':')[1];
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(textBytes, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
    }
}