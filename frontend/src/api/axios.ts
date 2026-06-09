import axios from 'axios';

// Instanța de bază pentru cereri publice
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // IMPORTANT pentru cookie-ul de refresh!
});

// Instanța protejată (necesită token)
export const apiPrivate = axios.create({
  baseURL: '/api',
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
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${accessToken}`);
      } else {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }
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
        if (typeof prevRequest.headers.set === 'function') {
          prevRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
        } else {
          prevRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        }
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

// Utilitar pentru apeluri `fetch` (SSE) care au nevoie de Refresh Token automat
// deoarece fetch() nu trece prin interceptorul axios de mai sus.
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  let token = getAccessToken();
  const getHeaders = () => ({
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  });

  let response = await fetch(url, { ...options, headers: getHeaders() });

  if (response.status === 401) {
    try {
      const refreshRes = await api.post('/auth/refresh');
      token = refreshRes.data.accessToken;
      setAccessToken(token);
      
      // Retry
      response = await fetch(url, { ...options, headers: getHeaders() });
    } catch (err) {
      setAccessToken(null);
      window.dispatchEvent(new Event('auth:unauthorized'));
      throw err;
    }
  }

  return response;
};
