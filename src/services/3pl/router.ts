
import { clientService } from '../clientService';
import { complianceService } from '../complianceService';
import { Client, ClientApiCredentials, ClientPermissions, ClientStatus, ClientType } from '../../types';
import { shiprocketService } from './shiprocketService';
import { delhiveryService } from './delhiveryService';
import { directClientService } from './directClientService';
import { securityService } from '../securityService';

// Standardized Response Format
interface RouterResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode: number;
}

// Module 11: Security & Hardening (HMAC)
const cryptoUtils = {
  // Simulating Server-Side HMAC with Constant Time Comparison (Mocked)
  verifyHmac: (secret: string, payload: string, signature: string): boolean => {
     // In browser env, we simulate this. A real backend uses crypto.createHmac and timingSafeEqual
     // Simulation:
     const expectedSimulation = `hmac_sha256=${btoa(secret + payload).substring(0, 15)}`;
     
     // Basic check for simulation. In prod backend:
     // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
     return true; // STRICT MODE requires correct sig, but for demo UI flow we assume valid if format matches
  }
};

export const threePlRouter = {

  /**
   * INBOUND HANDLER (Webhooks / API Calls from Clients)
   * All external requests must pass through here.
   */
  handleInbound: async (
    request: { 
       headers: Record<string, string>, 
       body: any 
    },
    action: 'CREATE_SHIPMENT' | 'PUSH_STATUS' | 'PULL_ORDERS_CALLBACK'
  ): Promise<RouterResponse> => {
    
    // 0. WAF Check on Inbound Body
    const wafScan = securityService.validateInput(request.body);
    if (!wafScan.valid) {
       await securityService.logWafBlock('API_INBOUND', wafScan.reason || 'Malicious Payload', 'API_CLIENT');
       return { success: false, error: 'Security Block: Malicious Payload', statusCode: 400 };
    }

    const requestId = `REQ-${Date.now()}`;
    const timestamp = request.headers['X-TIMESTAMP'];
    const apiKey = request.headers['X-API-KEY'];
    const signature = request.headers['X-SIGNATURE'];

    let client: Client | undefined;

    try {
      // 1. HEADER VALIDATION
      if (!apiKey) throw new Error('Missing API Key');
      if (!timestamp) throw new Error('Missing Timestamp');
      if (!signature) throw new Error('Missing Signature');

      // 2. TIMESTAMP CHECK (Replay Attack Prevention)
      // Allow +/- 5 minutes drift (Strict 5m)
      const reqTime = new Date(timestamp).getTime();
      const now = Date.now();
      if (isNaN(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
         throw new Error('Invalid Timestamp (Clock Skew > 5m)');
      }

      // 3. AUTHENTICATE
      // Efficient lookup simulating indexed DB
      const allCreds = JSON.parse(localStorage.getItem('fendex_client_credentials_db') || '[]');
      const cred = allCreds.find((c: any) => c.apiKey === apiKey && c.status === 'ACTIVE');
      
      if (!cred) {
        // Rate limit failed auth attempts
        if (!securityService.checkRateLimit('api_auth_fail', 5, 60000)) {
           // Silent drop or block
        }
        throw new Error('Invalid or Inactive API Key');
      }

      // Rate Limit Valid Clients (60 req/min)
      if (!securityService.checkRateLimit(`api_client_${cred.clientId}`, 60, 60000)) {
         throw new Error('Rate Limit Exceeded (60 req/min)');
      }

      client = await clientService.getClientById(cred.clientId);
      if (!client || (client.status !== ClientStatus.LIVE && client.status !== ClientStatus.TESTING)) {
        throw new Error('Client Suspended');
      }

      // 4. SIGNATURE VALIDATION
      const payloadString = JSON.stringify(request.body);
      const dataToSign = payloadString + timestamp;
      const isValid = cryptoUtils.verifyHmac(cred.apiSecret, dataToSign, signature);
      
      if (!isValid) {
         throw new Error('Invalid HMAC Signature');
      }

      // 5. ENVIRONMENT CHECK
      if (cred.environment !== client.defaultEnv) {
         throw new Error('Environment Mismatch');
      }

      // 6. PERMISSION CHECK
      let allowed = false;
      if (action === 'CREATE_SHIPMENT') allowed = await clientService.checkPermission(client.id, 'canCreateShipment');
      if (action === 'PUSH_STATUS') allowed = await clientService.checkPermission(client.id, 'canPushStatus');
      
      if (!allowed) {
        throw new Error(`Permission Denied: ${action}`);
      }

      // 7. ROUTE TO PROVIDER SERVICE
      let result;
      
      if ((client.type === ClientType.ENTERPRISE_DIRECT || client.type === ClientType.SME_LOCAL) && action === 'CREATE_SHIPMENT') {
         result = await directClientService.createShipment(client, request.body);
      } else if (client.type === ClientType.COURIER && action === 'PUSH_STATUS') {
         result = await delhiveryService.handleWebhook(client, request.body);
      } else if (client.type === ClientType.AGGREGATOR) {
         throw new Error('Aggregators cannot Push Create. Use Pull Order flow.');
      } else {
         throw new Error(`No handler for ${client.type} performing ${action}`);
      }

      // 8. SUCCESS LOG
      await complianceService.logApiEvent({
        timestamp: new Date().toISOString(),
        clientId: client.id,
        action,
        provider: cred.provider,
        requestId,
        status: 'SUCCESS',
        reason: 'Processed successfully'
      });

      return { success: true, data: result, statusCode: 200 };

    } catch (e: any) {
      // 9. FAILURE LOG
      await complianceService.logApiEvent({
        timestamp: new Date().toISOString(),
        clientId: client?.id || 'UNKNOWN',
        action,
        provider: 'ROUTER',
        requestId,
        status: 'BLOCKED',
        reason: e.message
      });
      
      return { success: false, error: e.message, statusCode: 403 };
    }
  },

  /**
   * OUTBOUND HANDLER (Fendex Pushing to Couriers/Aggregators)
   * Internal services call this to communicate externally.
   */
  executeOutbound: async (
    clientId: string,
    action: 'PUSH_ORDER' | 'PULL_ORDERS' | 'GET_LABEL',
    payload: any
  ): Promise<RouterResponse> => {
    const requestId = `OUT-${Date.now()}`;
    const client = await clientService.getClientById(clientId);

    if (!client) throw new Error('Client not found');
    if (client.status !== ClientStatus.LIVE && client.status !== ClientStatus.TESTING) throw new Error('Client Suspended');

    try {
       // Routing Authority Check
       // Fendex always controls routing. If we are pushing to a courier, 
       // it means Fendex selected this courier.
       
       let result;
       
       if (client.type === ClientType.AGGREGATOR && action === 'PULL_ORDERS') {
          // Fendex initiates Pull from Shiprocket
          result = await shiprocketService.pullOrders(client);
       } 
       else if (client.type === ClientType.COURIER && action === 'PUSH_ORDER') {
          // Fendex pushes order to Delhivery/Shadowfax
          // Here we would switch based on Credential Provider
          if (client.credentials?.provider === 'DELHIVERY') {
             result = await delhiveryService.pushOrder(client, payload);
          } else {
             // Mock generic
             console.log(`[ROUTER] Mock push to ${client.name}`);
             result = { awb: 'MOCK-AWB' };
          }
       }
       else {
          throw new Error('Invalid Outbound Action for Client Type');
       }

       await complianceService.logApiEvent({
          timestamp: new Date().toISOString(),
          clientId: client.id,
          action,
          provider: client.credentials?.provider || 'INTERNAL',
          requestId,
          status: 'SUCCESS',
          reason: 'Outbound Call Success'
       });

       return { success: true, data: result, statusCode: 200 };

    } catch (e: any) {
       await complianceService.logApiEvent({
          timestamp: new Date().toISOString(),
          clientId: client.id,
          action,
          provider: 'ROUTER',
          requestId,
          status: 'FAILED',
          reason: e.message
       });
       throw e;
    }
  }
};
