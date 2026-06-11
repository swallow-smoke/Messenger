import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { config } from './config';

export const storage = {
  async get(key: string): Promise<string | null> {
    if (window.electron) return window.electron.storage.get(key);
    return localStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (window.electron) { await window.electron.storage.set(key, value); return; }
    localStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    if (window.electron) { await window.electron.storage.delete(key); return; }
    localStorage.removeItem(key);
  },
};

const api = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true,
});

api.interceptors.request.use(async (axiosConfig: InternalAxiosRequestConfig) => {
  const token = await storage.get('accessToken');
  if (token && axiosConfig.headers) {
    axiosConfig.headers.Authorization = `Bearer ${token}`;
  }
  return axiosConfig;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      isRefreshing = true;
      try {
        const refreshToken = await storage.get('refreshToken');
        const { data } = await axios.post(`${config.apiUrl}/auth/refresh`, { refreshToken });
        await storage.set('accessToken', data.accessToken);
        await storage.set('refreshToken', data.refreshToken);
        refreshQueue.forEach((cb) => cb(data.accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        await storage.remove('accessToken');
        await storage.remove('refreshToken');
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }

    // Show toast for non-401 errors
    if (err.response?.status !== 401) {
      const msg =
        (err.response?.data as { error?: string } | undefined)?.error ??
        `API Error ${err.response?.status ?? 'unknown'}`;
      toast.error(msg, { id: `api-err-${err.response?.status}` });
    }

    return Promise.reject(err);
  }
);

export default api;
