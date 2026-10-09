import axios from 'axios';

const baseURL = `${import.meta.env.VITE_API_URL || ''}/api`;

// The access token lives in memory only; the refresh token is an httpOnly cookie.
let accessToken = null;
let onSessionExpired = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

// 60 s: a sleeping free-plan server can take most of a minute to wake up, and photo uploads can be slow on mobile data.
const api = axios.create({ baseURL, withCredentials: true, timeout: 60000 });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// One refresh at a time; concurrent 401s wait for the same promise.
let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.data.accessToken);
        return res.data.data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !original._retried && !isAuthCall && accessToken) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  }
);

/** Human-friendly message from any API error. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (error?.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
  return fallback;
}

export const fieldErrors = (error) =>
  Object.fromEntries((error?.response?.data?.errors || []).map((e) => [e.field, e.message]));

/** Builds a FormData body: JSON fields under "data", files under their field name (one file or a list). */
export function toFormData(data, files = {}) {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  Object.entries(files).forEach(([field, list]) => {
    if (!list) return;
    (list instanceof Blob ? [list] : [...list]).forEach((f) => form.append(field, f));
  });
  return form;
}

export const fileUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${import.meta.env.VITE_API_URL || ''}${path}`;
};

export default api;
