import { useContext } from 'react';
import { AuthContext } from './AuthContext';

/**
 * Hook dedicat pentru a consuma AuthContext.
 * Separat de AuthContext.tsx pentru a satisface regula react-refresh/only-export-components:
 * un fișier nu trebuie să exporte atât componente cât și hook-uri.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
