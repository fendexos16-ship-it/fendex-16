
import { db, FieldValue } from './firebaseAdmin';
import { getTimestampIST } from './dateUtils';
import { UserRole } from './types';

interface AuditParams {
  userId: string;
  role: UserRole;
  action: string;
  fmId?: string;
  awb: string;
  lmdcId: string;
  details?: any;
}

export const logFmAction = async (params: AuditParams) => {
  const logRef = db.collection('audit_logs').doc();
  const logData = {
    ...params,
    timestamp: getTimestampIST(),
    server_timestamp: FieldValue.serverTimestamp(),
    module: 'FM_PICKUP'
  };
  
  await logRef.set(logData);
  console.log(`[AUDIT][FM] ${params.action} | AWB: ${params.awb} | By: ${params.userId}`);
};
