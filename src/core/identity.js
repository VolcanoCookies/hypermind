const crypto = require("crypto");
const { MY_POW_PREFIX } = require("../config/constants");
const { generateScreenname } = require("../utils/name-generator");
const { readFileSync } = require("fs");

const generateIdentity = () => {
    let publicKey, privateKey;
    if (process.env.IDENTITY_PRIVATE_KEY && process.env.IDENTITY_PUBLIC_KEY) {
        const privateKeyDer = process.env.IDENTITY_PRIVATE_KEY;
        const publicKeyDer = process.env.IDENTITY_PUBLIC_KEY;

        const privateKeyData = readFileSync(privateKeyDer);
        const publicKeyData = readFileSync(publicKeyDer);

        privateKey = crypto.createPrivateKey({
            key: privateKeyData,
            format: "der",
            type: "pkcs8",
        });
        publicKey = crypto.createPublicKey({
            key: publicKeyData,
            format: "der",
            type: "spki",
        });
    } else {
        const keyPair = crypto.generateKeyPairSync("ed25519");
        publicKey = keyPair.publicKey;
        privateKey = keyPair.privateKey;
    }

    const id = publicKey.export({ type: "spki", format: "der" }).toString("hex");
    const screenname = generateScreenname(id);

    let nonce = 0;
    while (true) {
        const hash = crypto
            .createHash("sha256")
            .update(id + nonce)
            .digest("hex");
        if (hash.startsWith(MY_POW_PREFIX)) break;
        nonce++;
    }

    return { publicKey, privateKey, id, nonce, screenname };
}

module.exports = { generateIdentity };
