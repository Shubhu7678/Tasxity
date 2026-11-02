import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('tasxity_token'));

  useEffect(() => {
    if (!localStorage.getItem('tasxity_token')) return;
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => localStorage.removeItem('tasxity_token'))
      .finally(() => setLoading(false));
  }, []);

  const authenticate = async (path, body) => {
    const { data } = await api.post(`/auth/${path}`, body);
    localStorage.setItem('tasxity_token', data.token);
    setUser(data.user);
  };

  const continueAsGuest = () => authenticate('guest');

  const logout = () => {
    localStorage.removeItem('tasxity_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login: (b) => authenticate('login', b), signup: (b) => authenticate('signup', b), continueAsGuest, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
