import React, { useState } from "react";
import { Cpu, Bell, Plus, LogOut, Menu, X, Sun, Moon } from "lucide-react";
import { NotificationPanel } from "../notifications/NotificationPanel";

export function Navbar({ tabs, activeTab, setTab, unreadCount, showNotifications, setShowNotifications, onOpenListModal, onLogout, themeToggle }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* ── Stitch-style navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 72,
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(195,192,255,0.4)",
        boxShadow: "0 4px 30px rgba(99,102,241,0.08), 0 1px 0 rgba(0,229,255,0.2)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 12,
        justifyContent: "space-between",
        fontFamily: "'Space Grotesk','Inter',sans-serif",
      }}>
        {/* Brand */}
        <div onClick={() => setTab("browse")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#00ffa3,#00c8ff,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(0,255,163,0.4)" }}>
            <Cpu size={18} color="#070C1E" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em", color: "#070C1E" }}>Campus</span>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em", background: "linear-gradient(135deg,#00c97a,#0ea5e9,#6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Search</span>
          </div>
          <span style={{ padding: "2px 8px", borderRadius: 9999, background: "linear-gradient(135deg,rgba(238,242,255,0.9),rgba(220,243,255,0.8))", border: "1px solid rgba(99,102,241,0.2)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 9, fontWeight: 700, color: "#4b41e1", letterSpacing: "0.06em", textTransform: "uppercase" }}>v2.4 PRO</span>
        </div>

        {/* Tabs — hidden on mobile */}
        <div className="desktop-only" style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "rgba(238,242,255,0.6)",
          padding: "6px",
          borderRadius: 9999,
          border: "1px solid rgba(255,255,255,0.6)",
          overflowX: "auto",
          maxWidth: "calc(100vw - 400px)",
          flexShrink: 1,
        }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "7px 12px",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 11,
              fontWeight: activeTab === t.id ? 700 : 600,
              transition: "all 0.2s ease",
              background: activeTab === t.id
                ? "linear-gradient(135deg,#00ffa3,#00c8ff,rgba(99,102,241,0.9))"
                : "transparent",
              color: activeTab === t.id ? "#070C1E" : "#64748b",
              boxShadow: activeTab === t.id ? "0 0 14px rgba(0,255,163,0.4)" : "none",
              whiteSpace: "nowrap",
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}>
              {t.icon}
              <span className="desktop-only" style={{ display: "inline" }}>{t.label}</span>
              {t.badge > 0 && (
                <span style={{ minWidth: 16, height: 16, borderRadius: 9999, background: "#ef4444", color: "#fff", fontFamily: "'Space Grotesk',sans-serif", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", boxShadow: "0 0 8px rgba(239,68,68,0.5)" }}>
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Theme toggle */}
          {themeToggle && (
            <div style={{ display: "contents" }}>{themeToggle}</div>
          )}

          {/* Notification bell */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowNotifications(!showNotifications)} style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.8)", border: "1px solid rgba(195,192,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b", transition: "all 0.2s ease", boxShadow: "0 2px 8px rgba(99,102,241,0.08)" }}>
              <Bell size={17} />
              {unreadCount > 0 && (
                <span style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 9999, background: "#ef4444", color: "#fff", fontFamily: "'Space Grotesk',sans-serif", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: "2px solid #fff", boxShadow: "0 0 8px rgba(239,68,68,0.5)" }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
          </div>

          {/* List Item */}
          <button onClick={onOpenListModal} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9999, background: "linear-gradient(135deg,#00ffa3,#00c8ff,#6366f1)", color: "#070C1E", fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 18px rgba(0,255,163,0.35)", transition: "all 0.2s ease", flexShrink: 0 }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 6px 22px rgba(0,229,255,0.45)"}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,255,163,0.35)"}>
            <Plus size={14} /> List Item
          </button>

          {/* Logout */}
          <button onClick={onLogout} className="desktop-only" title="Log out" style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.8)", border: "1px solid rgba(195,192,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b", transition: "all 0.2s ease" }}>
            <LogOut size={16} />
          </button>

          {/* Mobile menu */}
          <button className="mobile-only" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.8)", border: "1px solid rgba(195,192,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}>
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Spacer so content isn't hidden under fixed nav */}
      <div style={{ height: 72 }} />

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,12,30,0.6)", backdropFilter: "blur(4px)", zIndex: 99, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }} onClick={() => setMobileMenuOpen(false)}>
          <div style={{ width: 280, maxHeight: "100vh", overflowY: "auto", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderLeft: "1px solid rgba(195,192,255,0.4)", padding: "80px 12px 24px", display: "flex", flexDirection: "column", gap: 4 }} onClick={(e) => e.stopPropagation()}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => { setTab(t.id); setMobileMenuOpen(false); }} style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, transition: "all 0.15s ease",
                background: activeTab === t.id ? "linear-gradient(135deg,rgba(0,255,163,0.15),rgba(0,229,255,0.1))" : "transparent",
                color: activeTab === t.id ? "#065f46" : "#334155",
                borderLeft: activeTab === t.id ? "3px solid #00ffa3" : "3px solid transparent" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>{t.icon} {t.label}</span>
                {t.badge > 0 && <span style={{ padding: "1px 8px", borderRadius: 9999, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700 }}>{t.badge}</span>}
              </button>
            ))}
            <div style={{ borderTop: "1px solid rgba(195,192,255,0.3)", marginTop: 8, paddingTop: 8 }}>
              <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", gap: 10, color: "#dc2626", background: "rgba(254,242,242,0.8)" }}>
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
