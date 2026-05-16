const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  // Auth
  login: async (credentials) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  signup: async (userData) => {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getMe: async () => {
    const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Onboarding
  savePreferences: async (preferences) => {
    const res = await fetch(`${API_URL}/onboarding`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(preferences),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  updateAssets: async (assets) => {
    const res = await fetch(`${API_URL}/onboarding/preferences/assets`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ assets }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Dashboard
  getDashboard: async () => {
    const res = await fetch(`${API_URL}/dashboard`, { headers: getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Price-only refresh — used after add/remove coin to avoid full dashboard reload
  getPrices: async () => {
    const res = await fetch(`${API_URL}/dashboard/prices`, { headers: getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Fetch chart data for a specific asset
  getChart: async (asset) => {
    const res = await fetch(`${API_URL}/dashboard/chart?asset=${encodeURIComponent(asset)}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Fetch AI insight separately (non-blocking)
  getAIInsight: async () => {
    const res = await fetch(`${API_URL}/dashboard/ai`, { headers: getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Feedback
  submitFeedback: async (feedback) => {
    const res = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(feedback),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
