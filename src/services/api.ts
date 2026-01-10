
import axios from 'axios';
import { securityService } from './securityService';

// Initialize Axios with Enterprise Defaults
// withCredentials: true is MANDATORY for HttpOnly cookies to be sent/received
const api = axios.create({
  baseURL: '/api', 
  withCredentials: true, 
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-App-Version': '1.1.0-PROD'
  }
});

// --- REQUEST INTERCEPTOR ---
api.interceptors.request.use(
  (config) => {
    // 1. WAF Check on Payload
    if (config.data) {
       const scan = securityService.validateInput(config.data);
       if (!scan.valid) {
          securityService.logWafBlock(config.url || 'unknown', scan.reason || 'Malicious Payload', 'CLIENT_IP');
          return Promise.reject(new Error(`Security Block: ${scan.reason}`));
       }
    }
    // Note: We no longer attach Bearer tokens manually. 
    // The browser handles the 'fendex_auth_token' cookie automatically via withCredentials: true.
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- RESPONSE INTERCEPTOR ---
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error('[SECURITY] 401 Unauthorized. Session Invalid.');
      localStorage.removeItem('fendex_session_v2'); // Clear UI state
      if (!window.location.hash.includes('login')) {
         window.location.href = '/#/login';
      }
      return Promise.reject(error);
    }
    const customError = error.response?.data?.message ? new Error(error.response.data.message) : error;
    return Promise.reject(customError);
  }
);

export default api;
