import React, { useState, useEffect, useCallback } from "react";
import { Search, Grid3X3, List, Radio, CheckCircle, Heart, Trash2 } from "lucide-react";
import { api } from "../api";
import { CATEGORIES, CATEGORY_ICONS } from "../constants/categories";
import { StatusDot } from "../components/common/StatusDot";
import { Badge } from "../components/common/Badge";
import { Avatar } from "../components/common/Avatar";
import { EmptyState } from "../components/common/EmptyState";
import { Skeleton } from "../components/common/Skeleton";
import { InquiryModal } from "../components/modals/InquiryModal";

// Real Unsplash imagery for component categories
const CATEGORY_IMAGES = {
  Microcontrollers: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
  Sensors: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80",
  "Motors & Actuators": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=400&q=80",
  "Power & Wiring": "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?auto=format&fit=crop&w=400&q=80",
  Tools: "https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=400&q=80",
  "Full Kits": "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=400&q=80",
  "Passive Components": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
};

export function BrowsePage({ onRequestListing }) {
  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [inquiryModalQuery, setInquiryModalQuery] = useState(null);
  const [freeOnly, setFreeOnly] = useState(false);
  // Pagination state
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("campus_favorites") || "[]");
    } catch {
      return [];
    }
  });

  const toggleFavorite = (item) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === item.id);
      const next = exists ? prev.filter((f) => f.id !== item.id) : [...prev, item];
      localStorage.setItem("campus_favorites", JSON.stringify(next));
      window.dispatchEvent(new Event("favorites_updated"));
      return next;
    });
  };

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getListings({ search, category, sort, limit: PAGE_SIZE, offset });
      // Handle paginated shape { items, total, limit, offset }
      if (data && Array.isArray(data.items)) {
        setListings(data.items);
        setTotal(data.total || 0);
      } else if (Array.isArray(data)) {
        // Fallback: server returned plain array (shouldn't happen after Task 8)
        setListings(data);
        setTotal(data.length);
      }
    } catch (e) {}
    setLoading(false);
  }, [search, category, sort, offset]);

  // Reset to page 0 when filters/search/sort change
  const resetAndLoad = useCallback(() => {
    setOffset(0);
  }, []);

  useEffect(() => { resetAndLoad(); }, [search, category, sort]);
  useEffect(() => { loadListings(); }, [loadListings]);

  return (
    <div className="page-enter">
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ marginBottom: 8 }}>Find Campus Engineering Components</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 540, margin: "0 auto" }}>
          Buy, sell, and trade Arduino boards, sensors, and robotics kits with verified campus peers.
        </p>
      </div>

      <div className="search-bar" style={{ marginBottom: 20 }}>
        <div className="search-bar__input-wrapper">
          <Search size={14} className="search-bar__icon" />
          <input
            className="input search-bar__input"
            placeholder="Search components (e.g. Arduino, ESP32, Servo, Sensor)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyUp={(e) => e.key === "Enter" && loadListings()}
            id="search-input"
          />
        </div>
        <div className="search-bar__filters">
          <select className="input" style={{ width: "auto", minWidth: 140 }} value={category} onChange={(e) => setCategory(e.target.value)} id="filter-category">
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="input" style={{ width: "auto", minWidth: 120 }} value={sort} onChange={(e) => setSort(e.target.value)} id="filter-sort">
            <option value="newest">Newest</option>
            <option value="price_low">Price: Low→High</option>
            <option value="price_high">Price: High→Low</option>
            <option value="rating">Top Rated</option>
            <option value="popular">Most Viewed</option>
          </select>
          <div style={{ display: "flex", gap: 2 }}>
            <button title="Grid View" aria-label="Grid View" className={`btn-icon ${viewMode === "grid" ? "btn-primary" : ""}`} onClick={() => setViewMode("grid")} style={viewMode === "grid" ? { background: "var(--signal)", color: "var(--bg-deep)", border: "none" } : {}}><Grid3X3 size={14} /></button>
            <button title="List View" aria-label="List View" className={`btn-icon ${viewMode === "list" ? "btn-primary" : ""}`} onClick={() => setViewMode("list")} style={viewMode === "list" ? { background: "var(--signal)", color: "var(--bg-deep)", border: "none" } : {}}><List size={14} /></button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        <button
          className={`btn btn-sm ${category === "All" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setCategory("All")}
          style={{ flexShrink: 0 }}
        >All</button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`btn btn-sm ${category === c ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setCategory(c)}
            style={{ flexShrink: 0 }}
          >
            {CATEGORY_ICONS[c]} {c}
          </button>
        ))}
        <button
          className={`btn btn-sm ${freeOnly ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setFreeOnly(!freeOnly)}
          style={{ flexShrink: 0 }}
        >
          🎁 Free / Giveaway (₹0)
        </button>
      </div>

      {loading ? (
        <div className="listing-grid"><Skeleton type="card" count={6} /></div>
      ) : (freeOnly ? listings.filter(l => l.price === 0) : listings).length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🔍"
            title="No matching components found"
            sub="Can't find what you need? Send a broadcast availability inquiry to all sellers!"
            action={
              <button className="btn btn-primary" onClick={() => setInquiryModalQuery({ category, query: search })}>
                <Radio size={14} /> Ask Availability Broadcast
              </button>
            }
          />
        </div>
      ) : viewMode === "grid" ? (
        <div className="listing-grid">
          {(freeOnly ? listings.filter(l => l.price === 0) : listings).map((l) => (
            <div key={l.id} className="card card-hover listing-card" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", height: "150px", overflow: "hidden", background: "var(--raised)" }}>
                <img
                  src={l.image_data || CATEGORY_IMAGES[l.category] || CATEGORY_IMAGES["Microcontrollers"]}
                  alt={l.item_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(l); }}
                  className="btn-icon"
                  title={favorites.some(f => f.id === l.id) ? "Remove from Favorites" : "Add to Favorites"}
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    background: "rgba(0,0,0,0.65)",
                    backdropFilter: "blur(4px)",
                    borderRadius: "50%",
                    padding: 6,
                    border: "none",
                    cursor: "pointer",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: favorites.some(f => f.id === l.id) ? "var(--red)" : "#fff"
                  }}
                >
                  <Heart size={15} fill={favorites.some(f => f.id === l.id) ? "var(--red)" : "none"} />
                </button>
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                  <StatusDot status={l.status} qty={l.quantity} />
                </div>
              </div>
              <div className="listing-card__body" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div className="listing-card__header">
                  <div className="listing-card__title">{l.item_name}</div>
                  {l.price === 0 ? (
                    <span className="listing-card__price listing-card__price--free">FREE</span>
                  ) : (
                    <span className="listing-card__price">₹{l.price}</span>
                  )}
                </div>
                <div className="listing-card__meta" style={{ marginBottom: 12 }}>
                  <Badge tone="muted">{l.category}</Badge>
                  {l.listing_type === "rent" && <Badge tone="primary">RENTAL</Badge>}
                  <span style={{ fontSize: 12 }}>{l.condition_notes}</span>
                </div>


                <div className="listing-card__footer" style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--trace)", paddingBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="listing-card__seller">
                    <Avatar name={l.seller_name} size="sm" />
                    <span style={{ fontSize: 12 }}>{l.seller_name}</span>
                    {l.seller_verified ? <CheckCircle size={14} color="var(--signal)" /> : null}
                  </div>
                  <button
                    className="btn-icon"
                    title="Delete listing (Cascade)"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete listing "${l.item_name}"? This cascades requests, payments, and ratings.`)) {
                        try {
                          await api.deleteListingPermanent(l.id);
                          setListings(prev => prev.filter(x => x.id !== l.id));
                        } catch (err) {
                          alert(err.message || "Failed to delete listing.");
                        }
                      }
                    }}
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      color: "#ef4444",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {l.status === "available" && (
                  <button
                    className="btn btn-primary btn-block"
                    onClick={() => onRequestListing(l)}
                  >
                    Request Item
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {(freeOnly ? listings.filter(l => l.price === 0) : listings).map((l) => (
            <div key={l.id} className="listing-row" style={{ cursor: l.status === "available" ? "pointer" : "default" }} onClick={() => l.status === "available" && onRequestListing(l)}>
              <span className="font-mono row-id" style={{ fontSize: 11, color: "var(--signal)" }}>{l.id.slice(0, 6)}</span>
              <div className="row-main">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(l); }}
                    className="btn-icon"
                    title={favorites.some(f => f.id === l.id) ? "Remove from Favorites" : "Add to Favorites"}
                    style={{ border: "none", background: "transparent", color: favorites.some(f => f.id === l.id) ? "var(--red)" : "var(--muted)", cursor: "pointer" }}
                  >
                    <Heart size={15} fill={favorites.some(f => f.id === l.id) ? "var(--red)" : "none"} />
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{l.item_name}</span>
                  {l.seller_verified ? <Badge tone="green">Verified</Badge> : null}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{l.condition_notes} · {l.seller_name}, {l.seller_department}</div>
              </div>
              <span className="font-mono row-price" style={{ fontSize: 14, justifySelf: "end" }}>{l.price === 0 ? "Free" : `₹${l.price}`}</span>
              <span className="row-status" style={{ justifySelf: "end" }}><StatusDot status={l.status} qty={l.quantity} /></span>
              <span className="row-action" style={{ justifySelf: "end", display: "flex", gap: 6, alignItems: "center" }}>
                <button disabled={l.status !== "available"} className="btn btn-ghost btn-sm">
                  {l.status === "available" ? "Request" : l.status}
                </button>
                <button
                  className="btn-icon"
                  title="Delete listing (Cascade)"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete listing "${l.item_name}"?`)) {
                      try {
                        await api.deleteListingPermanent(l.id);
                        setListings(prev => prev.filter(x => x.id !== l.id));
                      } catch (err) {
                        alert(err.message || "Failed to delete listing.");
                      }
                    }
                  }}
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "#ef4444",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer"
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {inquiryModalQuery && (
        <InquiryModal
          initialCategory={inquiryModalQuery.category}
          initialQuery={inquiryModalQuery.query}
          onClose={() => setInquiryModalQuery(null)}
        />
      )}

      {/* Pagination controls — only shown when there's more than one page */}
      {!loading && total > PAGE_SIZE && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 24 }}>
          <button
            className="btn btn-ghost btn-sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
