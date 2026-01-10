
import express from 'express';
import { fmController } from './fmController';
import { authenticate, authorize } from './backendMiddleware';
import { UserRole } from './types';

const router = express.Router();

// Middleware Chain: Auth -> Logic -> Role Check
router.use(authenticate);

/**
 * AUTHORITATIVE ENDPOINTS
 */

// LMDC: Initialization & Management
router.post('/create', 
  // Fix: UserRole.LMDC -> UserRole.LMDC_MANAGER
  authorize([UserRole.LMDC_MANAGER, UserRole.FOUNDER]), 
  fmController.create
);

router.post('/assign', 
  // Fix: UserRole.LMDC -> UserRole.LMDC_MANAGER
  authorize([UserRole.LMDC_MANAGER, UserRole.FOUNDER]), 
  fmController.assign
);

// RIDER: Execution Flow
router.get('/rider-tasks',
  authorize([UserRole.RIDER]),
  fmController.getRiderTasks
);

router.post('/pickup', 
  authorize([UserRole.RIDER]), 
  fmController.pickup
);

router.post('/metadata',
  authorize([UserRole.RIDER]),
  fmController.submitMetadata
);

// LMDC: Station Receipt & Closure
router.post('/inbound', 
  // Fix: UserRole.LMDC -> UserRole.LMDC_MANAGER
  authorize([UserRole.LMDC_MANAGER, UserRole.FOUNDER]), 
  fmController.inbound
);

router.post('/close', 
  // Fix: UserRole.LMDC -> UserRole.LMDC_MANAGER
  authorize([UserRole.LMDC_MANAGER, UserRole.FOUNDER]), 
  fmController.close
);

export default router;
