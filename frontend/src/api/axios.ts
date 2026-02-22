import axios from 'axios';

// Instanța de bază pentru cereri publice
export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // IMPORTANT pentru cookie-ul de refresh!
});

// Instanța protejată (necesită token)
export const apiPrivate = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Stocăm token-ul de access în memorie
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => {
  return accessToken;
};

// Interceptor pentru adăugarea token-ului la Fiecare Request
apiPrivate.interceptors.request.use(
  (config) => {
    if (accessToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor pentru reîmprospătarea token-ului atunci când expiră (401)
apiPrivate.interceptors.response.use(
  (response) => response,
  async (error) => {
    const prevRequest = error?.config;
    if (error?.response?.status === 401 && !prevRequest?.sent) {
      prevRequest.sent = true;
      try {
        // Facem apelul de refresh (frontend-ul trimite cookie-ul HttpOnly automat)
        const response = await api.post('/auth/refresh');
        const newAccessToken = response.data.accessToken;
        setAccessToken(newAccessToken);

        // Re-trimitem cererea originală cu noul token
        prevRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return apiPrivate(prevRequest);
      } catch (err) {
        // Dacă refresh-ul eșuează (ex. refresh token expirat 7 zile)
        setAccessToken(null);
        // Putem emite un eveniment de logout aici sau returna reject
        window.dispatchEvent(new Event('auth:unauthorized'));
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);
