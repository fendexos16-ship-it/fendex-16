
/**
 * FENDEX LOGISTICS - CORE IDENTITY SERVICE
 * Environment: Google Cloud Run
 * Database: Firestore (Native)
 */

const express = require('express');
const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// --- INITIALIZATION ---
const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: [
    'https://app.fendexlog.in',
    'https://appdex.fendexlog.in', 
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version', 'X-Requested-With']
}));

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod';
const TOKEN_EXPIRY = '24h';
const COOKIE_NAME = 'fendex_auth_token';

// --- MIDDLEWARE ---
const authenticate = async (req, res, next) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Session Invalid" });
  }
};

/**
 * ADMIN ONLY: SAFE OPERATIONAL RESET
 * Purges all operational users, DC mappings, MMDCs, and Riders.
 * Strictly preserves FOUNDER role.
 */
const cleanupOperationalUsers = async (actorId) => {
  console.log(`[ADMIN] Full Operational Cleanup initiated by: ${actorId}`);
  
  const stats = {
    usersDeleted: 0,
    dcUsersDeleted: 0,
    documentsDeleted: 0,
    dcMasterDeleted: 0,
    mmDcsDeleted: 0,
    ridersDeleted: 0,
    preserved: ['fendexlogistics@gmail.com']
  };

  const collectionsToPurge = [
    { name: 'users', preserveField: 'role', preserveValue: 'FOUNDER' },
    { name: 'dc_users' },
    { name: 'documents' },
    { name: 'dc_master', preserveField: '_init', preserveValue: true },
    { name: 'mm_dcs' },
    { name: 'riders' },
    { name: 'shipments' },
    { name: 'runsheets' },
    { name: 'payout_batches' }
  ];

  for (const col of collectionsToPurge) {
    const snap = await db.collection(col.name).get();
    const batch = db.batch();
    let count = 0;

    snap.docs.forEach(doc => {
      const data = doc.data();
      if (col.preserveField && data[col.preserveField] === col.preserveValue) {
        return;
      }
      batch.delete(doc.ref);
      count++;
    });

    if (count > 0) {
      await batch.commit();
      if (col.name === 'users') stats.usersDeleted = count;
      if (col.name === 'dc_users') stats.dcUsersDeleted = count;
      if (col.name === 'documents') stats.documentsDeleted = count;
      if (col.name === 'dc_master') stats.dcMasterDeleted = count;
      if (col.name === 'mm_dcs') stats.mmDcsDeleted = count;
      if (col.name === 'riders') stats.ridersDeleted = count;
    }
  }

  console.log('[ADMIN] Full Cleanup Complete:', stats);
  return stats;
};

// --- ROUTES ---

app.get('/', (req, res) => {
  res.status(200).send('Fendex Identity Core v1.2.0 [Safe Reset & Onboarding Ready]');
});

/**
 * MANUAL TRIGGER FOR CLEANUP (FOUNDER ONLY)
 * Purges MMDC, LMDC, and Rider data to allow fresh start.
 */
app.post('/api/admin/safe-operational-reset', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'FOUNDER') {
      return res.status(403).json({ success: false, message: "Access Denied: Founder privilege required." });
    }

    const audit = await cleanupOperationalUsers(req.user.uid);
    
    return res.status(200).json({ 
      success: true, 
      message: "System reset successful. System ready for fresh MMDC/LMDC/Rider onboarding.",
      audit
    });
  } catch (error) {
    console.error("[CRITICAL] Reset Failure:", error);
    return res.status(500).json({ success: false, message: "Internal failure during purge." });
  }
});

/**
 * AUTHENTICATION
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Credentials required." });

    const sanitizedEmail = email.toLowerCase().trim();
    const snapshot = await db.collection('users').where('email', '==', sanitizedEmail).limit(1).get();

    if (snapshot.empty) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.status !== 'ACTIVE') return res.status(403).json({ success: false, message: "Account disabled." });

    // Founder preserved credentials check
    const match = (password === userData.password); 
    
    if (!match) {
        const hashedMatch = userData.passwordHash ? await bcrypt.compare(password, userData.passwordHash) : false;
        if (!hashedMatch) return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ 
        uid: userDoc.id, 
        email: userData.email, 
        role: userData.role,
        dc_id: userData.dc_id || null 
    }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.cookie(COOKIE_NAME, token, {
       httpOnly: true,
       secure: true,
       sameSite: 'none',
       domain: '.fendexlog.in',
       path: '/',
       maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      user: { id: userDoc.id, email: userData.email, role: userData.role, status: userData.status }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Auth Service Error" });
  }
});

app.post('/api/auth/logout', (req, res) => {
   res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'none', domain: '.fendexlog.in', path: '/' });
   res.status(200).json({ success: true, message: 'Logged out' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Fendex Identity Core active on port ${PORT}`);
});
