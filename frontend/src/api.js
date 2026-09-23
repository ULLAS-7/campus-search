/**
 * CampusSearch v2.0 API client
 * Handles: Auth (USN + ID photo), Listings, Requests, Ratings, Admin (ID Verification Queue),
 *          Notifications (+ SSE), Notion, Wishlists, Profiles, Messages,
 *          Inquiries (Broadcast availability flow), Payments (UPI QR).
 */
const BASE = import.meta.env.VITE_API_URL || "/api";


function authHeaders() {
  const token = localStorage.getItem("cs_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  try {
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    
    if (res.status === 502 || res.status === 503) {
      window.dispatchEvent(new Event("server_sleeping"));
      throw new Error("Server is waking up...");
    }

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
        window.dispatchEvent(new Event("auth_error"));
      }
      throw new Error(data.error || "Request failed");
    }
    
    window.dispatchEvent(new Event("server_awake"));
    return data;
  } catch (err) {
    if (err.message === "Failed to fetch" || err.message === "NetworkError when attempting to fetch resource.") {
      window.dispatchEvent(new Event("server_sleeping"));
    }
    throw err;
  }
}

export const api = {
  // ---- Auth ----
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  changePassword: (body) => request("/auth/change-password", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body) => request("/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),

  // ---- Listings ----
  getListings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/listings?${qs}`);
  },
  getListing: (id) => request(`/listings/${id}`),
  createListing: (body) => request("/listings", { method: "POST", body: JSON.stringify(body) }),
  updateListing: (id, body) => request(`/listings/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteListing: (id) => request(`/listings/${id}`, { method: "DELETE" }),
  suggestPrice: (params) => request(`/listings/suggest-price?${new URLSearchParams(params).toString()}`),

  // ---- Requests (direct matching flow) ----
  createRequest: (listing_id, quantity = 1) => request("/requests", { method: "POST", body: JSON.stringify({ listing_id, quantity }) }),
  respondToRequest: (id, decision, delivery_day) =>
    request(`/requests/${id}/respond`, { method: "PATCH", body: JSON.stringify({ decision, delivery_day }) }),
  confirmDelivered: (id) => request(`/requests/${id}/confirm-delivered`, { method: "PATCH" }),
  getContact: (id) => request(`/requests/${id}/contact`),
  myRequests: () => request("/requests/mine"),

  // ---- Inquiries (v2.0: broadcast availability flow) ----
  createInquiry: (body) => request("/inquiries", { method: "POST", body: JSON.stringify(body) }),
  myInquiries: () => request("/inquiries/mine"),
  incomingInquiries: () => request("/inquiries/incoming"),
  respondToInquiry: (id, body) => request(`/inquiries/${id}/respond`, { method: "POST", body: JSON.stringify(body) }),
  acceptInquiryResponse: (inquiryId, response_id) =>
    request(`/inquiries/${inquiryId}/accept-response`, { method: "POST", body: JSON.stringify({ response_id }) }),

  // ---- Payments (v2.0: UPI QR) ----
  getPaymentIntent: (requestId) => request(`/payments/intent/${requestId}`),
  confirmPayment: (intentId) => request(`/payments/confirm/${intentId}`, { method: "POST" }),

  // ---- Ratings ----
  rate: (body) => request("/ratings", { method: "POST", body: JSON.stringify(body) }),

  // ---- Admin & Verification Queue (v2.0) ----
  adminStats: () => request("/admin/stats"),
  adminFlags: () => request("/admin/flags"),
  resolveFlag: (id, action) => request(`/admin/flags/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }),
  getPendingVerifications: () => request("/admin/pending-verifications"),
  verifyUser: (id) => request(`/admin/verify-user/${id}`, { method: "POST" }),
  rejectUser: (id, reason) => request(`/admin/reject-user/${id}`, { method: "POST", body: JSON.stringify({ reason }) }),
  suspendUser: (id, reason) => request(`/admin/users/${id}/suspend`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  getFlaggedUsers: () => request("/admin/flagged-users"),

  // ---- Notifications ----
  getNotifications: (unreadOnly = false) =>
    request(`/notifications${unreadOnly ? "?unread=true" : ""}`),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  getUnreadCount: () => request("/notifications/unread-count"),
  markRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => request("/notifications/all/read", { method: "PATCH" }),

  // ---- Notion Knowledge Hub ----
  notionHub: () => request("/notion/hub"),
  notionSearch: (q) => request(`/notion/search?q=${encodeURIComponent(q)}`),
  notionPage: (id) => request(`/notion/pages/${id}`),

  // ---- Wishlists ----
  getWishlists: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/wishlists?${qs}`);
  },
  getMyWishlists: () => request("/wishlists/mine"),
  createWishlist: (body) => request("/wishlists", { method: "POST", body: JSON.stringify(body) }),
  deleteWishlist: (id) => request(`/wishlists/${id}`, { method: "DELETE" }),

  // ---- Profiles ----
  getMyProfile: () => request("/profiles/me"),
  getProfile: (id) => request(`/profiles/${id}`),
  updateMyProfile: (body) => request("/profiles/me", { method: "PATCH", body: JSON.stringify(body) }),


  // ---- Messages ----
  getMessages: (requestId) => request(`/messages/${requestId}`),
  sendMessage: (requestId, body) =>
    request(`/messages/${requestId}`, { method: "POST", body: JSON.stringify({ body }) }),

  // ---- V3.0 Neural Copilot & Escrow Handshake ----
  getNeuralStatus: () => request("/v3/neural/status"),
  neuralSearch: (query, minConfidence = 30) => request("/v3/neural/search", {
    method: "POST",
    body: JSON.stringify({ query, minConfidence })
  }),
  optimizeBOM: (bomText, projectType) => request("/v3/neural/bom-optimize", {
    method: "POST",
    body: JSON.stringify({ bomText, projectType })
  }),
  generateEscrowHandshake: (data) => request("/v3/neural/handshake/generate", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  // ---- V3.2 Circuit Topology & Pinout Interconnect Validator ----
  getCircuitStatus: () => request("/v3/circuit/status"),
  getCircuitPresets: () => request("/v3/circuit/presets"),
  validateCircuitTopology: (components) => request("/v3/circuit/validate", {
    method: "POST",
    body: JSON.stringify({ components })
  }),

  // ---- Enterprise Upgrade: Hardware Topology Mesh Corridors ----
  getComponentRelations: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "")
    );
    const qs = new URLSearchParams(cleanParams).toString();
    return request(`/component-relations${qs ? `?${qs}` : ""}`);
  },
  getComponentRelationMetrics: () => request("/component-relations/metrics"),
  createComponentRelation: (body) => request("/component-relations", {
    method: "POST",
    body: JSON.stringify(body)
  }),
  deleteComponentRelation: (id) => request(`/component-relations/${id}`, { method: "DELETE" }),
  uploadComponentRelations: (csvOrJson) => {
    const isString = typeof csvOrJson === "string";
    return request("/component-relations/upload", {
      method: "POST",
      headers: isString ? { "Content-Type": "text/plain" } : { "Content-Type": "application/json" },
      body: isString ? csvOrJson : JSON.stringify(csvOrJson)
    });
  },

  // ---- Enterprise Upgrade: Universal Batch Ingestion & Deletions ----
  uploadListings: (csvOrJson) => {
    const isString = typeof csvOrJson === "string";
    return request("/listings/upload", {
      method: "POST",
      headers: isString ? { "Content-Type": "text/plain" } : { "Content-Type": "application/json" },
      body: isString ? csvOrJson : JSON.stringify(csvOrJson)
    });
  },
  uploadWishlists: (csvOrJson) => {
    const isString = typeof csvOrJson === "string";
    return request("/wishlists/upload", {
      method: "POST",
      headers: isString ? { "Content-Type": "text/plain" } : { "Content-Type": "application/json" },
      body: isString ? csvOrJson : JSON.stringify(csvOrJson)
    });
  },
  uploadInquiries: (csvOrJson) => {
    const isString = typeof csvOrJson === "string";
    return request("/inquiries/upload", {
      method: "POST",
      headers: isString ? { "Content-Type": "text/plain" } : { "Content-Type": "application/json" },
      body: isString ? csvOrJson : JSON.stringify(csvOrJson)
    });
  },
  uploadUsers: (csvOrJson) => {
    const isString = typeof csvOrJson === "string";
    return request("/admin/users/upload", {
      method: "POST",
      headers: isString ? { "Content-Type": "text/plain" } : { "Content-Type": "application/json" },
      body: isString ? csvOrJson : JSON.stringify(csvOrJson)
    });
  },
  deleteListingPermanent: (id) => request(`/listings/${id}?permanent=true`, { method: "DELETE" }),
  deleteInquiry: (id) => request(`/inquiries/${id}`, { method: "DELETE" }),
  deleteRequest: (id) => request(`/requests/${id}`, { method: "DELETE" }),
  getAdminUsers: () => request("/admin/users"),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),

  // ---- Admin Panel ----
  adminStats: () => request("/admin/stats"),
  adminFlags: () => request("/admin/flags"),
  getPendingVerifications: () => request("/admin/pending-verifications"),
  resolveFlag: (id, action) => request(`/admin/flags/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }),
  verifyUser: (id) => request(`/admin/verify-user/${id}`, { method: "POST" }),
  rejectUser: (id, reason) => request(`/admin/reject-user/${id}`, { method: "POST", body: JSON.stringify({ reason }) }),
};

// Real Server-Sent Events connection with automatic polling fallback.
//
// Opens an EventSource to /api/notifications/stream?token=<jwt>.
// Browser EventSource cannot send custom headers, so the token is passed
// as a query param — the backend uses requireAuthViaQuery on that one route only.
//
// If EventSource fails (network error, restrictive proxy, unsupported browser)
// it automatically falls back to the original 4-second polling so nothing breaks.
export function connectSSE(onEvent) {
  const token = localStorage.getItem("cs_token");
  if (!token) return null;

  let eventSource = null;
  let pollInterval = null;
  let lastCount = -1;
  let usingFallback = false;

  // ── Polling fallback (used when SSE is unavailable) ────────────────────
  const startPolling = () => {
    if (pollInterval) return; // already polling
    usingFallback = true;
    const poll = async () => {
      try {
        const { count } = await api.getUnreadCount();
        if (count !== lastCount) {
          lastCount = count;
          onEvent({ type: "notification_count", count });
        }
      } catch (e) {}
    };
    poll();
    pollInterval = setInterval(poll, 4000);
  };

  const stopPolling = () => {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  };

  // ── Real SSE connection ────────────────────────────────────────────────
  const openSSE = () => {
    if (typeof EventSource === "undefined") {
      // Browser doesn't support SSE — fall back immediately
      startPolling();
      return;
    }

    try {
      const url = `${BASE}/notifications/stream?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        usingFallback = false;
        stopPolling(); // SSE working — stop polling if it was running
      };

      // Handle typed events pushed by notificationService
      eventSource.addEventListener("notification", (e) => {
        try {
          const data = JSON.parse(e.data);
          onEvent(data);
        } catch (_) {}
      });

      eventSource.addEventListener("notification_count", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.count !== lastCount) {
            lastCount = data.count;
            onEvent({ type: "notification_count", count: data.count });
          }
        } catch (_) {}
      });

      eventSource.addEventListener("message", (e) => {
        try { onEvent(JSON.parse(e.data)); } catch (_) {}
      });

      eventSource.onerror = () => {
        // Connection dropped or blocked — fall back to polling
        if (!usingFallback) {
          startPolling();
        }
        // Don't close: browser will auto-reconnect EventSource; if it keeps
        // failing, polling already covers the user.
      };
    } catch (e) {
      // EventSource constructor threw (e.g. in a test environment) — fall back
      startPolling();
    }
  };

  openSSE();

  return {
    close: () => {
      stopPolling();
      if (eventSource) { eventSource.close(); eventSource = null; }
    },
  };
}

export function setToken(token) {
  localStorage.setItem("cs_token", token);
}
export function clearToken() {
  localStorage.removeItem("cs_token");
}
export function hasToken() {
  return !!localStorage.getItem("cs_token");
}

export default api;
if (typeof window !== "undefined") {
  window.api = api;
}

// Triggering Vercel rebuild for frozen UI bug fix

