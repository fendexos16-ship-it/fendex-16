
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
 * ADMIN ONLY: SYSTEM RESET
 * Cleans all operational data, preserves Founder.
 * Strictly manual invocation.
 */
const performSystemReset = async (actorId) => {
  console.log(`[ADMIN] System Reset initiated by: ${actorId}`);
  
  const collections = ['dc_master', 'dc_users', 'documents', 'riders', 'users'];
  const stats = { deleted: {}, preserved: 0 };

  for (const colName of collections) {
    const snap = await db.collection(colName).get();
    let colDeleted = 0;
    
    const batch = db.batch();
    
    snap.docs.forEach(doc => {
      const data = doc.data();
      
      // PRESERVATION RULES
      if (colName === 'users' && data.role === 'FOUNDER') {
        stats.preserved++;
        return;
      }
      if (data._init === true) {
        return; 
      }

      batch.delete(doc.ref);
      colDeleted++;
    });

    await batch.commit();
    stats.deleted[colName] = colDeleted;
  }

  console.log('[ADMIN] Reset Complete:', stats);
  return stats;
};

// --- ROUTES ---

app.get('/', (req, res) => {
  res.status(200).send('Fendex Identity Core v1.1.0 [Operational Reset Ready]');
});

/**
 * MANUAL RESET ENDPOINT (FOUNDER ONLY)
 */
app.post('/api/admin/system-purge-reset', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'FOUNDER') {
      return res.status(403).json({ success: false, message: "Access Denied: Founder Only" });
    }

    const stats = await performSystemReset(req.user.uid);
    
    return res.status(200).json({ 
      success: true, 
      message: "Operational data purged. System ready for fresh onboarding.",
      audit: stats
    });
  } catch (error) {
    console.error("[CRITICAL_ERR] Reset Failure:", error);
    return res.status(500).json({ success: false, message: "Reset failed during execution." });
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

    // Note: Since we are in reset mode, passwords for demo/test accounts are gone.
    // Founder password Nithya1996@@ is maintained in Firestore.
    // In production, bcrypt.compare is used.
    const match = (password === userData.password); // Placeholder for standardized reset creds if needed, though Founder is preserved
    
    if (!match) {
        // Fallback for bcrypt if already hashed in DB
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
