import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, getAccessToken, setAccessToken } from '../api/axios';

interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Funcția principală pentru Hydration (Silent Refresh inițial la încărcarea paginii)
  useEffect(() => {
    const hydrateAuth = async () => {
      try {
        // Încercăm din prima să generăm un access token folosind cookie-ul HttpOnly
        const res = await api.post('/auth/refresh');
        const { accessToken, user: userData } = res.data;

        setAccessToken(accessToken);
        setUser(userData);
      } catch (err) {
        // Dacă eșuează înseamnă că utilizatorul nu e logat deloc. Rămânem la starea nulă.
        console.log("No active session detected.");
      } finally {
        setIsLoading(false);
      }
    };

    hydrateAuth();

    // Ascultăm evenimentul aruncat de Axios atunci când refresh-ul eșuează (token expirat global)
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = (accessToken: string, userData: User) => {
    setAccessToken(accessToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout'); // Spune backend-ului să invalideze cookie-ul refresh
    } catch (err) {
      console.error(err);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
