
import axios from 'axios';

// Initialize Axios with Enterprise Defaults
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30000, // 30s Timeout for resilience
  headers: {
    'Content-Type': 'application/json',
    'X-App-Version': '1.0.0-LIVE'
  }
});

// --- REQUEST INTERCEPTOR ---
// Automatically attach authentication tokens to every outgoing request
api.interceptors.request.use(
  (config) => {
    const session = localStorage.getItem('fendex_session_v1');
    if (session) {
      try {
        const user = JSON.parse(session);
        // Assuming the backend expects a Bearer token or User ID for context
        // In a real JWT setup: config.headers.Authorization = `Bearer ${user.token}`;
        if (user.id) {
          config.headers['X-User-ID'] = user.id;
          config.headers['X-User-Role'] = user.role;
        }
      } catch (e) {
        console.warn('Failed to parse session for API headers', e);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- RESPONSE INTERCEPTOR ---
// Global error handling for consistent behavior
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 1. Security: Handle Unauthorized Access
    if (error.response && error.response.status === 401) {
      console.error('[SECURITY] 401 Unauthorized detected. Terminating session.');
      localStorage.removeItem('fendex_session_v1');
      window.location.href = '/#/login';
      return Promise.reject(error);
    }

    // 2. Resilience: Handle Server Errors
    if (error.response && error.response.status >= 500) {
      console.error('[API] Server Error:', error.response.data);
      // Optional: Trigger a toast or global alert here if integrated
    }

    // 3. Network: Handle Connectivity Issues
    if (!error.response) {
      console.error('[API] Network Error or Timeout');
    }

    return Promise.reject(error);
  }
);

export default api;
