// Creates the Ed25519 key that signs Hudini Host updates. Run once: node tools/signing-key.mjs
// The private key goes to ~/hudini-signing.key (owner-only) and is never printed: paste it into the GitHub secret
// HUDINI_SIGNING_KEY, keep a copy in a password manager, then delete the file. The public key goes to
// ~/hudini-signing.pub and into `const UPDATE_KEY` in host/server.js.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const priv = path.join(os.homedir(), 'hudini-signing.key'), pub = path.join(os.homedir(), 'hudini-signing.pub');
if(fs.existsSync(priv)){ console.error(`${priv} already exists, not overwriting it.`); process.exit(1); }
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(priv, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600, flag: 'wx' });
fs.writeFileSync(pub, publicKey.export({ format: 'der', type: 'spki' }).toString('base64') + '\n');
console.log(`Private key: ${priv} (only you can read it; it is not shown here)`);
console.log(`Public key:  ${pub}`);
