// lib/api.ts
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
const token = localStorage.getItem("access") || localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    // Agar token expire ho gaya ho toh login par bhej dein
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return response;
};