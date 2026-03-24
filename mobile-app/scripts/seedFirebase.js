/**
 * Seed-script: voegt initiële data toe aan Firestore via Firebase Admin SDK.
 *
 * Gebruik:
 * 1) Download een service-account JSON vanuit Firebase Console.
 * 2) Zet een van deze env vars:
 *    - FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./secrets/firebase-admin.json
 *    - FIREBASE_SERVICE_ACCOUNT_KEY_JSON='{"type":"service_account",...}'
 * 3) Run: node scripts/seedFirebase.js
 */

const fs = require('fs');
const path = require('path');

function loadAdminSdk() {
  try {
    const admin = require('firebase-admin');
    const { getFirestore } = require('firebase-admin/firestore');
    return { admin, getFirestore };
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      console.error('Fout: package firebase-admin ontbreekt.');
      console.error('Installeer met: npm install firebase-admin --legacy-peer-deps');
      process.exit(1);
    }
    throw error;
  }
}

const { admin, getFirestore } = loadAdminSdk();

function parseServiceAccount(rawJson) {
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    throw new Error('Service account JSON is ongeldig.');
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Service account JSON mist client_email of private_key.');
  }

  return parsed;
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON) {
    return parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON);
  }

  const configuredPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!configuredPath) {
    throw new Error(
      'Zet FIREBASE_SERVICE_ACCOUNT_KEY_PATH of FIREBASE_SERVICE_ACCOUNT_KEY_JSON voordat je seedt.'
    );
  }

  const absolutePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Service account bestand niet gevonden: ${absolutePath}`);
  }

  return parseServiceAccount(fs.readFileSync(absolutePath, 'utf8'));
}

function createDb() {
  if (!admin.apps.length) {
    const serviceAccount = loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
  }

  return getFirestore();
}

const db = createDb();

const CLUBS = [
  { id: '1', name: 'Sporthal Antwerpen', address: 'Antwerpen Centrum' },
  { id: '2', name: 'Voetbalclub Berchem', address: 'Berchem, Antwerpen' },
  { id: '3', name: 'FC Deurne', address: 'Deurne, Antwerpen' },
  { id: '4', name: 'Sportcomplex Wilrijk', address: 'Wilrijk, Antwerpen' },
];

const APP_CONFIG = {
  timeSlots: ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'],
  formats: ['5v5', '7v7', '11v11'],
  levelMin: 0.5,
  levelMax: 7.0,
  levelStep: 0.5,
};

async function seed() {
  console.log('Seeding clubs...');
  for (const club of CLUBS) {
    await db.collection('clubs').doc(club.id).set({
      name: club.name,
      address: club.address,
    }, { merge: true });
    console.log(`  ✓ ${club.name}`);
  }

  console.log('Seeding appConfig...');
  await db.collection('appConfig').doc('settings').set(APP_CONFIG, { merge: true });
  console.log('  ✓ appConfig/settings');

  console.log('\nKlaar! Data staat nu in Firebase.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Fout:', err);
  process.exit(1);
});
