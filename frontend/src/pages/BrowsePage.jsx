import React, { useState, useEffect, useCallback } from "react";
import { Search, Grid3X3, List, Radio, CheckCircle, Heart, Trash2, ChevronLeft, ChevronRight, Cpu, Zap } from "lucide-react";
import { api } from "../api";
import { CATEGORIES, CATEGORY_ICONS } from "../constants/categories";
import { Avatar } from "../components/common/Avatar";
import { EmptyState } from "../components/common/EmptyState";
import { Skeleton } from "../components/common/Skeleton";
import { InquiryModal } from "../components/modals/InquiryModal";

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
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [inquiryModalQuery, setInquiryModalQuery] = useState(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem("campus_favorites") || "[]"); } catch { return []; }
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
      if (data && Array.isArray(data.items)) {
        setListings(data.items);
        setTotal(data.total || 0);
      } else if (Array.isArray(data)) {
        setListings(data); setTotal(data.length);
      }
    } catch (e) {}
    setLoading(false);
  }, [search, category, sort, offset]);

  useEffect(() => { setOffset(0); }, [search, category, sort]);
  useEffect(() => { loadListings(); }, [loadListings]);

  const displayItems = freeOnly ? listings.filter((l) => l.price === 0) : listings;

  const StatusBadge = ({ status, qty }) => {
    if (status === "available") return (
      <span className="badge-stitch-avail">
        <span className="pulse-dot" style={{ width: 6, height: 6 }} />
        Available{qty > 1 ? ` ×${qty}` : ""}
      </span>
    );
    if (status === "pending") return (
      <span className="badge-stitch-pending">
        <span className="pulse-dot pulse-dot--amber" style={{ width: 6, height: 6 }} />
        Pending
      </span>
    );
    return <span className="badge-stitch-pending" style={{ border: "1px solid rgba(226,102,95,0.4)", color: "#991b1b" }}>{status}</span>;
  };

  return (
    <div style={{ minHeight: "100vh", padding: "24px 0 80px", fontFamily: "'Space Grotesk','Inter',sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── HUD bar ── */}
        <div className="glass-holo" style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,rgba(0,255,163,0.2),rgba(0,229,255,0.1),rgba(99,102,241,0.1))", border: "1px solid rgba(0,229,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(0,255,163,0.2)", flexShrink: 0 }}>
              <Cpu size={22} color="var(--st-indigo)" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, color: "var(--st-navy)" }}>Campus Hardware Registry</span>
                <span style={{ padding: "2px 10px", borderRadius: 9999, background: "linear-gradient(135deg,var(--st-mint),rgba(0,229,255,0.6))", border: "1px solid rgba(0,255,163,0.4)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 9, fontWeight: 700, color: "var(--st-navy)", textTransform: "uppercase", letterSpacing: "0.08em", boxShadow: "0 0 10px rgba(0,255,163,0.3)" }}>Grid Online</span>
              </div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--st-muted-dim)" }}>Verified student-to-student testbenches, modules, devkits &amp; lab gear</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ padding: "8px 16px", borderRadius: 9999, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(0,229,255,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="pulse-dot" style={{ width: 10, height: 10 }} />
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700, color: "var(--st-navy)" }}>{total} Units In-Mesh</span>
            </div>
          </div>
        </div>

        {/* ── Filter panel ── */}
        <div className="glass-holo" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Search + sort row */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--st-muted-dim)", pointerEvents: "none" }} />
              <input className="input-stitch" placeholder="Search devkits, microcontrollers, sensors..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyUp={(e) => e.key === "Enter" && loadListings()} style={{ paddingLeft: 44 }} />
            </div>
            <div style={{ position: "relative", minWidth: 160 }}>
              <select className="input-stitch" value={category} onChange={(e) => setCategory(e.target.value)} style={{ paddingRight: 36, appearance: "none" }}>
                <option value="All">All Departments</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ position: "relative", minWidth: 160 }}>
              <select className="input-stitch" value={sort} onChange={(e) => setSort(e.target.value)} style={{ paddingRight: 36, appearance: "none" }}>
                <option value="newest">Sort: Newest</option>
                <option value="price_low">Price: Low → High</option>
                <option value="price_high">Price: High → Low</option>
                <option value="rating">Top Rated</option>
                <option value="popular">Most Viewed</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--st-container)", borderRadius: 9999, border: "1px solid rgba(195,192,255,0.3)", flexShrink: 0 }}>
              {[{ id: "grid", icon: <Grid3X3 size={16} /> }, { id: "list", icon: <List size={16} /> }].map((v) => (
                <button key={v.id} onClick={() => setViewMode(v.id)} style={{ width: 36, height: 36, borderRadius: 9999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease",
                  background: viewMode === v.id ? "rgba(255,255,255,1)" : "transparent",
                  color: viewMode === v.id ? "var(--st-indigo)" : "var(--st-muted-dim)",
                  boxShadow: viewMode === v.id ? "0 2px 8px rgba(99,102,241,0.2)" : "none" }}>
                  {v.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Category chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            <button className={`chip-stitch ${category === "All" ? "chip-stitch--active" : ""}`} onClick={() => setCategory("All")}>All</button>
            {CATEGORIES.map((c) => (
              <button key={c} className={`chip-stitch ${category === c ? "chip-stitch--active" : ""}`} onClick={() => setCategory(c)}>
                {CATEGORY_ICONS[c]} {c}
              </button>
            ))}
            <button className={`chip-stitch ${freeOnly ? "chip-stitch--active" : ""}`} onClick={() => setFreeOnly(!freeOnly)} style={freeOnly ? {} : { borderColor: "rgba(187,0,86,0.3)", color: "var(--st-rose)" }}>
              🎁 Free / Giveaway
            </button>
          </div>

          {/* Count */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: "var(--st-muted-dim)" }}>
              Showing <strong style={{ color: "var(--st-navy)" }}>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)}</strong> of <strong style={{ color: "var(--st-navy)" }}>{total}</strong> components
            </span>
          </div>
        </div>

        {/* ── Grid / List ── */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
            <Skeleton type="card" count={8} />
          </div>
        ) : displayItems.length === 0 ? (
          <div className="glass-holo" style={{ padding: 48, textAlign: "center" }}>
            <EmptyState icon="🔍" title="No matching components found"
              sub="Can't find what you need? Send a broadcast availability inquiry to all sellers!"
              action={<button className="btn-stitch-primary" onClick={() => setInquiryModalQuery({ category, query: search })} style={{ margin: "0 auto", marginTop: 16 }}><Radio size={16} /> Ask Availability Broadcast</button>} />
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 20 }}>
            {displayItems.map((l) => (
              <div key={l.id} className="glass-holo" style={{ display: "flex", flexDirection: "column" }}>
                {/* Image */}
                <div style={{ position: "relative", height: 168, overflow: "hidden", borderRadius: "var(--st-radius-card) var(--st-radius-card) 0 0", background: "var(--st-container)" }}>
                  <img src={l.image_data || CATEGORY_IMAGES[l.category] || CATEGORY_IMAGES["Microcontrollers"]} alt={l.item_name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease" }}
                    onMouseEnter={(e) => e.target.style.transform = "scale(1.05)"}
                    onMouseLeave={(e) => e.target.style.transform = "scale(1)"} />
                  {/* Favorite */}
                  <button onClick={(e) => { e.stopPropagation(); toggleFavorite(l); }} style={{ position: "absolute", top: 10, left: 10, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                    <Heart size={14} fill={favorites.some((f) => f.id === l.id) ? "var(--st-rose)" : "none"} color={favorites.some((f) => f.id === l.id) ? "var(--st-rose)" : "var(--st-muted)"} />
                  </button>
                  {/* Status */}
                  <div style={{ position: "absolute", top: 10, right: 10 }}>
                    <StatusBadge status={l.status} qty={l.quantity} />
                  </div>
                  {l.listing_type === "rent" && (
                    <span style={{ position: "absolute", bottom: 10, left: 10, padding: "3px 10px", borderRadius: 9999, background: "var(--st-indigo)", color: "#fff", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700 }}>RENTAL</span>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 700, color: "var(--st-navy)", lineHeight: 1.3, flex: 1 }}>{l.item_name}</h3>
                    {l.price === 0 ? (
                      <span style={{ padding: "3px 10px", borderRadius: 9999, background: "linear-gradient(135deg,rgba(239,68,68,0.1),rgba(244,63,94,0.1))", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626", fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>FREE</span>
                    ) : (
                      <span style={{ padding: "3px 10px", borderRadius: 9999, background: "linear-gradient(135deg,rgba(0,255,163,0.12),rgba(0,229,255,0.1))", border: "1px solid rgba(0,255,163,0.3)", color: "#065f46", fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>₹{l.price}</span>
                    )}
                  </div>

                  {/* Spec tags */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 9999, background: "var(--st-container)", border: "1px solid rgba(195,192,255,0.4)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 600, color: "var(--st-indigo)" }}>{l.category}</span>
                    {l.condition && <span style={{ padding: "3px 10px", borderRadius: 9999, background: "var(--st-container)", border: "1px solid rgba(195,192,255,0.4)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 600, color: "var(--st-muted)" }}>{l.condition.replace("_", " ")}</span>}
                  </div>

                  {l.condition_notes && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--st-muted-dim)", lineHeight: 1.5, flex: 1 }}>{l.condition_notes}</p>}

                  {/* Footer */}
                  <div style={{ paddingTop: 12, borderTop: "1px solid rgba(195,192,255,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={l.seller_name} size="sm" />
                      <div>
                        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 600, color: "var(--st-navy)" }}>{l.seller_name}</span>
                        {l.seller_verified ? <CheckCircle size={12} color="#10b981" style={{ display: "inline", marginLeft: 4 }} /> : null}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${l.item_name}"?`)) { api.deleteListingPermanent(l.id).then(() => setListings((p) => p.filter((x) => x.id !== l.id))).catch((err) => alert(err.message)); } }}
                      style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {l.status === "available" && (
                    <button onClick={() => onRequestListing(l)} className="btn-stitch-primary" style={{ width: "100%", padding: "10px 16px", fontSize: 13, marginTop: 4 }}>
                      Request Item
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-holo" style={{ overflow: "hidden" }}>
            {displayItems.map((l, i) => (
              <div key={l.id} onClick={() => l.status === "available" && onRequestListing(l)} style={{ display: "grid", gridTemplateColumns: "60px 1fr auto auto auto", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < displayItems.length - 1 ? "1px solid rgba(195,192,255,0.2)" : "none", cursor: l.status === "available" ? "pointer" : "default", transition: "background 0.15s ease" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(238,242,255,0.5)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--st-mint)", fontWeight: 700 }}>{l.id.slice(0, 6)}</span>
                <div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: "var(--st-navy)" }}>{l.item_name}</div>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "var(--st-muted-dim)", marginTop: 2 }}>{l.condition_notes} · {l.seller_name}</div>
                </div>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 700, color: l.price === 0 ? "var(--st-rose)" : "#065f46" }}>{l.price === 0 ? "Free" : `₹${l.price}`}</span>
                <StatusBadge status={l.status} qty={l.quantity} />
                <button disabled={l.status !== "available"} onClick={(e) => { e.stopPropagation(); onRequestListing(l); }}
                  style={{ padding: "6px 14px", borderRadius: 9999, border: "1px solid rgba(195,192,255,0.4)", background: l.status === "available" ? "var(--st-container)" : "transparent", color: l.status === "available" ? "var(--st-indigo)" : "var(--st-muted-dim)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, cursor: l.status === "available" ? "pointer" : "not-allowed" }}>
                  {l.status === "available" ? "Request" : l.status}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && total > PAGE_SIZE && (
          <div className="pagination-stitch">
            <button className="btn-stitch-secondary" style={{ padding: "10px 20px", fontSize: 13 }} disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
              <ChevronLeft size={16} /> Prev
            </button>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: "var(--st-muted)", fontWeight: 600 }}>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of <strong style={{ color: "var(--st-navy)" }}>{total}</strong> components
            </span>
            <button className="btn-stitch-secondary" style={{ padding: "10px 20px", fontSize: 13 }} disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── Broadcast banner ── */}
        <div className="glass-holo" style={{ padding: "32px 40px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -60, top: -60, width: 320, height: 320, background: "rgba(0,229,255,0.1)", borderRadius: "50%", filter: "blur(60px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: -60, bottom: -60, width: 280, height: 280, background: "rgba(99,102,241,0.1)", borderRadius: "50%", filter: "blur(60px)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,rgba(0,255,163,0.2),rgba(0,229,255,0.1),rgba(99,102,241,0.1))", border: "1px solid rgba(0,229,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 18px rgba(0,255,163,0.25)" }}>
                <Radio size={26} color="var(--st-indigo)" />
              </div>
              <div>
                <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 9999, background: "linear-gradient(135deg,var(--st-mint),rgba(0,229,255,0.6))", border: "1px solid rgba(0,255,163,0.4)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 9, fontWeight: 700, color: "var(--st-navy)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Peer Mesh Telemetry • Sub-10min avg response</span>
                <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--st-navy)", marginBottom: 6 }}>Can't find the specific IC, probe, or module?</h3>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: "var(--st-muted)", maxWidth: 500 }}>Broadcast an immediate peer alert across 200+ connected lab inventories, maker clubs, and engineering dorms.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <button className="btn-stitch-primary" onClick={() => setInquiryModalQuery({ category, query: search })} style={{ fontSize: 13 }}>
                <Zap size={16} /> Broadcast Lab Alert
              </button>
            </div>
          </div>
        </div>
      </div>

      {inquiryModalQuery && (
        <InquiryModal initialCategory={inquiryModalQuery.category} initialQuery={inquiryModalQuery.query} onClose={() => setInquiryModalQuery(null)} />
      )}
    </div>
  );
}
