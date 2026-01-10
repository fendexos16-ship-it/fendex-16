
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
 * CORE RESET ENGINE: Full Operational Purge
 * Target: users, master records, and all operational documents.
 * Safeguard: Preserves Founder identity and _init flags.
 */
const resetAllOperationalData = async (actorId) => {
  console.log(`[CRITICAL] Full System Reset requested by Administrator: ${actorId}`);
  
  const audit = {
    collections_processed: [],
    deleted_counts: {},
    errors: []
  };

  const collections = [
    'users',
    'dc_master',
    'dc_users',
    'mmdc_master',
    'lmdc_master',
    'riders',
    'rider_master',
    'pincode_master',
    'documents',
    'shipments',
    'runsheets',
    'payout_batches',
    'bags',
    'pickups',
    'fm_pickups',
    'rvp_db',
    'audit_logs'
  ];

  for (const colName of collections) {
    try {
      const colRef = db.collection(colName);
      const snapshot = await colRef.get();
      
      if (snapshot.empty) continue;

      const batch = db.batch();
      let deletedInCol = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // RULE: PRESERVE FOUNDER
        if (colName === 'users' && (data.role === 'FOUNDER' || data.email === 'fendexlogistics@gmail.com')) {
          return;
        }

        // RULE: PRESERVE SYSTEM INIT MARKERS
        if (data._init === true) {
          return;
        }

        batch.delete(doc.ref);
        deletedInCol++;
      });

      if (deletedInCol > 0) {
        await batch.commit();
      }

      audit.collections_processed.push(colName);
      audit.deleted_counts[colName] = deletedInCol;
      console.log(`[RESET] Purged ${deletedInCol} documents from ${colName}`);

    } catch (err) {
      console.error(`[RESET_ERR] Failure in collection ${colName}:`, err.message);
      audit.errors.push(`${colName}: ${err.message}`);
    }
  }

  console.log(`[CRITICAL] System Reset Completed at ${new Date().toISOString()}`);
  return audit;
};

// --- ROUTES ---

app.get('/', (req, res) => {
  res.status(200).send('Fendex Backend v1.3.0 [RESET_CAPABLE]');
});

/**
 * ADMIN: TRIGGER FULL SYSTEM PURGE
 * Restricted to Founder role only.
 */
app.post('/api/admin/system-full-reset', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'FOUNDER') {
      return res.status(403).json({ success: false, message: "Security Block: Founder Access Required" });
    }

    const resetAudit = await resetAllOperationalData(req.user.uid);
    
    return res.status(200).json({ 
      success: true, 
      message: "Operational reset successful. System returned to zero-data state.",
      audit: resetAudit
    });
  } catch (error) {
    console.error("[SYSTEM_FAILURE] Reset Exception:", error);
    return res.status(500).json({ success: false, message: "Reset failed during batch commit." });
  }
});

/**
 * AUTHENTICATION (HttpOnly Cookie Pattern)
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

    if (userData.status !== 'ACTIVE' && userData.status !== 'Active') {
      return res.status(403).json({ success: false, message: "Account disabled." });
    }

    // Direct match for founder during reset phase, fallback to bcrypt in production logic
    let match = (password === userData.password);
    if (!match && userData.passwordHash) {
       match = await bcrypt.compare(password, userData.passwordHash);
    }

    if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ 
        uid: userDoc.id, 
        email: userData.email, 
        role: userData.role 
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
    return res.status(500).json({ success: false, message: "Internal Auth Error" });
  }
});

app.post('/api/auth/logout', (req, res) => {
   res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'none', domain: '.fendexlog.in', path: '/' });
   res.status(200).json({ success: true, message: 'Session Terminated' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Fendex Identity Core v1.3.0 listening on port ${PORT}`);
});
