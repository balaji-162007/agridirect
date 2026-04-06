// ============================================================ 
// FILE: api.js  (your frontend API config / fetch wrapper) 
// FIX 4: Centralised API base, auth headers, error handling 
// ============================================================ 

// ✅ FIX: Set the correct backend base URL 
const API_BASE = (() => { 
  if (typeof window === "undefined") return ""; 
  // Auto-detect: if running on localhost, use local backend 
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") { 
    return "http://localhost:8000/api"; 
  } 
  // Production: your Render backend URL (updated for production)
  return "https://agridirect-zwew.onrender.com/api"; 
})(); 

// Make globally available 
 
export const BASE_URL = API_BASE.replace(/\/api$/, "");

/**
 * Generates a full URL for an image path, handling absolute, data, and relative paths.
 */
export const getFullImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  // Ensure we don't have double slashes if path starts with /
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // Standardize on the constant BASE_URL
  return `${BASE_URL}${cleanPath}`;
};

// ───────────────────────────────────────── 
// TOKEN MANAGEMENT 
// ───────────────────────────────────────── 

function getToken() { 
  // Unified with existing auth logic
  return localStorage.getItem("token") || ""; 
} 

function setToken(token) { 
  if (token) localStorage.setItem("token", token); 
  else localStorage.removeItem("token"); 
} 

// ───────────────────────────────────────── 
// CORE FETCH WRAPPER 
// ───────────────────────────────────────── 

/** 
 * Central API fetch — handles auth, JSON, errors, CORS 
 */ 
async function apiFetch(endpoint, options = {}) { 
  const token = getToken(); 

  const defaultHeaders = { 
    "Content-Type": "application/json", 
    Accept: "application/json",
  }; 

  // Fast-caching for GET requests (Fix 2)
  if (!options.method || options.method.toUpperCase() === 'GET') {
    options.cache = options.cache || "default"; // or "force-cache" if user wants more aggressive
    // Optionally add a cache-control header if needed for the proxy
  }

  // Add auth header if token exists 
  if (token) { 
    defaultHeaders["Authorization"] = `Bearer ${token}`; 
  } 

  // Don't override Content-Type for FormData 
  if (options.body instanceof FormData) { 
    delete defaultHeaders["Content-Type"]; 
  } 

  const config = { 
    ...options, 
    headers: { 
      ...defaultHeaders, 
      ...(options.headers || {}), 
    } 
  }; 

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  try { 
    const response = await fetch(url, config); 

    // Handle 401 Unauthorized 
    if (response.status === 401) { 
      throw new Error("Session expired. Please login again."); 
    } 

    // Handle non-JSON error responses 
    const contentType = response.headers.get("content-type"); 
    if (!response.ok) { 
      if (contentType && contentType.includes("application/json")) { 
        const errData = await response.json(); 
        const msg = errData.detail 
          ? (Array.isArray(errData.detail) ? errData.detail.map(d => d.msg).join('; ') : errData.detail)
          : (errData.message || errData.error || `Request failed: ${response.status}`);
        throw new Error(msg); 
      } else { 
        throw new Error(`Request failed: ${response.status} ${response.statusText}`); 
      } 
    } 

    // Empty response (204 No Content) 
    if (response.status === 204) return null; 

    // Parse JSON 
    if (contentType && contentType.includes("application/json")) { 
      const data = await response.json();
      console.log(`API SUCCESS: ${url}`, data); // Debug logging
      return data; 
    } 

    return null; 
  } catch (error) { 
    // Friendly message for CORS/network errors 
    if ( 
      error.message.includes("Failed to fetch") || 
      error.message.includes("NetworkError") || 
      error.message.includes("ERR_FAILED") || 
      error.message.includes("ERR_NAME_NOT_RESOLVED") ||
      error.message.includes("ERR_CONNECTION_CLOSED") ||
      error.message.includes("ERR_NETWORK_IO_SUSPENDED")
    ) { 
      // Only log once to avoid console flooding during downtime
      if (!window._last_api_error || Date.now() - window._last_api_error > 30000) {
        console.warn("API server unreachable:", url);
        window._last_api_error = Date.now();
      }
      throw new Error("Cannot reach server. Check your internet connection or server status."); 
    } 
    throw error; 
  } 
} 

// ───────────────────────────────────────── 
// SPECIFIC API CALLS (replace your existing ones) 
// ───────────────────────────────────────── 

const API = { 
  // Auth 
  sendOTP: (phone, role) => apiFetch("/auth/send-otp", { method: "POST", body: JSON.stringify({ phone, role }) }), 
  verifyOTP: (phone, otp) => apiFetch("/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, otp }) }), 
  register: (formData) => apiFetch("/auth/register", { method: "POST", body: formData }),

  // Products 
  getProducts: (params = {}) => { 
    const query = new URLSearchParams(params).toString(); 
    return apiFetch(`/products${query ? "?" + query : ""}`); 
  }, 
  getProduct: (id) => apiFetch(`/products/${id}`), 
  getCategoryCounts: () => apiFetch("/products/categories/counts"),
  createProduct: (data) => {
    const isFormData = data instanceof FormData;
    return apiFetch("/farmer/products", { 
      method: "POST", 
      body: isFormData ? data : JSON.stringify(data) 
    });
  }, 
  updateProduct: (id, data) => {
    const isFormData = data instanceof FormData;
    return apiFetch(`/farmer/products/${id}`, { 
      method: "PUT", 
      body: isFormData ? data : JSON.stringify(data) 
    });
  }, 
  deleteProduct: (id) => apiFetch(`/farmer/products/${id}`, { method: "DELETE" }), 

  // Farmers 
  getFarmers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/farmers${query ? "?" + query : ""}`);
  },
  getFarmerStats: () => apiFetch("/farmer/stats"), 
  getFarmerProducts: () => apiFetch("/farmer/products"), 
  getFarmerOrders: () => apiFetch("/farmer/orders"), 
  getFarmerProfile: (id) => apiFetch(`/farmers/${id}`), 
  updateFarmerProfile: (data) => {
    const isFormData = data instanceof FormData;
    return apiFetch("/auth/profile", { 
      method: "PUT", 
      body: isFormData ? data : JSON.stringify(data) 
    });
  }, 

  // Orders 
  createOrder: (data) => apiFetch("/orders", { method: "POST", body: JSON.stringify(data) }), 
  getMyOrders: () => apiFetch("/orders/customer"), 
  getOrder: (id) => apiFetch(`/orders/${id}`),
  updateOrderStatus: (id, status) => apiFetch(`/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }), 
  cancelOrder: (id) => apiFetch(`/orders/${id}/cancel`, { method: "PUT" }), 
  getDeliverySlots: (date) => apiFetch(`/delivery/slots?delivery_date=${date}`),

  // Market prices 
  getMarketPrices: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/market-prices${query ? "?" + query : ""}`);
  }, 
  getMarketDistricts: () => apiFetch("/market-prices/districts"),

  // Health / Misc
  getHealth: () => apiFetch("/health"),

  // Notifications 
  getNotifications: () => apiFetch("/notifications"), 
  markNotificationRead: (id) => apiFetch(`/notifications/${id}/read`, { method: "PUT" }), 
  markAllNotificationsRead: () => apiFetch("/notifications/read-all", { method: "PUT" }), 

  // Push Notifications
  getVapidPublicKey: () => apiFetch("/push/vapid-public-key"),
  subscribePush: (subscription) => apiFetch("/push/subscribe", { method: "POST", body: JSON.stringify(subscription) }),
  unsubscribePush: (subscription) => apiFetch("/push/unsubscribe", { method: "POST", body: JSON.stringify(subscription) }),

  // Reviews 
  submitReview: (data) => apiFetch("/reviews", { method: "POST", body: JSON.stringify(data) }), 
  getFeaturedReviews: () => apiFetch("/reviews/featured"),
  getProductReviews: (productId) => apiFetch(`/products/${productId}/reviews`),
  getCustomerReviews: () => apiFetch("/customer/reviews"),
  getFarmerReviews: () => apiFetch("/farmer/reviews"),

  // Payments
  createPaymentOrder: (amount, currency = 'INR') => apiFetch('/payments/create-order', { method: 'POST', body: JSON.stringify({ amount, currency }) }),
  verifyPayment: (data) => apiFetch('/payments/verify', { method: 'POST', body: JSON.stringify(data) }),

  // Image Upload (multipart) 
  uploadImages: async (files) => { 
    const formData = new FormData(); 
    Array.from(files).slice(0, 5).forEach((f) => formData.append("images", f)); 
    return apiFetch("/upload/multiple", { method: "POST", body: formData }); 
  }, 
}; 

// ───────────────────────────────────────── 
// NOTIFICATIONS - safe fetch with null guard 
// ───────────────────────────────────────── 

async function fetchUnreadCount() { 
  try { 
    const data = await API.getNotifications(); 
    const count = Array.isArray(data) 
      ? data.filter((n) => !n.read).length 
      : (data?.unreadCount ?? 0); 

 
    return count; 
  } catch (err) { 
    // Silently fail — notifications are non-critical 
    console.warn("Could not fetch notifications:", err.message); 
    return 0; 
  } 
} 

// ───────────────────────────────────────── 
// FARMER STATS  - safe fetch with null guard 
// ───────────────────────────────────────── 

async function fetchFarmerStats() { 
  try { 
    const data = await API.getFarmerStats(); 

 

 

    return data; 
  } catch (err) { 
    console.error("Stats error:", err.message); 
    return null; 
  } 
} 

// Export
export { API_BASE, apiFetch, API, getToken, setToken, fetchUnreadCount, fetchFarmerStats };
