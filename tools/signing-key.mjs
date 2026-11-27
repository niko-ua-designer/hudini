// Creates an Ed25519 signing key. Run once for each kind:
//   node tools/signing-key.mjs        signs Hudini Host updates: secret HUDINI_SIGNING_KEY, `const UPDATE_KEY` in server/server.js
//   node tools/signing-key.mjs site   signs the widget files of the site: secret HUDINI_SITE_SIGNING_KEY, `const SITE_KEY`
// The private key goes to ~/hudini-signing.key or ~/hudini-site-signing.key (owner-only) and is never printed: paste it into
// the GitHub secret, keep a copy in a password manager, then delete the file. The public key goes to the .pub file next to it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const kind = process.argv[2] || 'update';
if(kind !== 'update' && kind !== 'site'){ console.error('Usage: node tools/signing-key.mjs [site]'); process.exit(1); }
const name = kind === 'site' ? 'hudini-site-signing' : 'hudini-signing';
const priv = path.join(os.homedir(), name + '.key'), pub = path.join(os.homedir(), name + '.pub');
// A public key that is already there belongs to a key in use: never replace it
if(fs.existsSync(pub)){ console.error(`${pub} already exists, not overwriting it.`); process.exit(1); }
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
try{ fs.writeFileSync(priv, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600, flag: 'wx' }); }
catch(e){ if(e.code==='EEXIST'){ console.error(`${priv} already exists, not overwriting it.`); process.exit(1); } throw e; }
fs.writeFileSync(pub, publicKey.export({ format: 'der', type: 'spki' }).toString('base64') + '\n');
console.log(`Private key: ${priv} (only you can read it; it is not shown here)`);
console.log(`Public key:  ${pub}`);
