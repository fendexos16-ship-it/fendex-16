
import admin from 'firebase-admin';

// In a real production environment, use serviceAccount credentials
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
// For this implementation, we assume the environment is already authenticated (e.g., via Google Cloud)
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
