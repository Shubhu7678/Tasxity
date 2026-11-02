import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tasxity_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errMsg = (e) => e.response?.data?.message || 'Something went wrong. Is the server running?';
export default api;
