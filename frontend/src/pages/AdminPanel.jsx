import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, AlertTriangle, Trash2, CheckCircle, XCircle, UserCheck, UserX, Flag, Shield, Badge, Activity } from "lucide-react";
import { api } from "../api";
import { EmptyState } from "../components/common/EmptyState";
import { Skeleton } from "../components/common/Skeleton";

const TABS = [
  { id: "verifications", label: "ID Verification Queue", icon: <UserCheck size={16} />, color: "#10b981" },
  { id: "flags",         label: "Flagged Content",       icon: <Flag size={16} />,      color: "#ef4444" },
  { id: "reliability",  label: "Reliability Flags",     icon: <UserX size={16} />,     color: "#f59e0b" },
];

export function AdminPanel() {
  const [stats, setStats] = useState({});
  const [flags, setFlags] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [flaggedUsers, setFlaggedUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("verifications");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, f, p] = await Promise.all([api.adminStats(), api.adminFlags(), api.getPendingVerifications()]);
      setStats(s); setFlags(f); setPendingVerifications(p);
      try { const fu = await api.getFlaggedUsers(); setFlaggedUsers(Array.isArray(fu) ? fu : []); } catch (_) { setFlaggedUsers([]); }
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action) => { await api.resolveFlag(id, action); load(); };
  const handleVerify = async (id) => { try { await api.verifyUser(id); load(); } catch (e) { alert("Failed: " + e.message); } };
  const handleReject = async (id) => {
    const reason = prompt("Reason for rejection:");
    if (reason === null) return;
    try { await api.rejectUser(id, reason); load(); } catch (e) { alert("Failed: " + e.message); }
  };

  if (loading) return <div style={{ padding: 32 }}><Skeleton type="card" count={3} /></div>;

  const STAT_CARDS = [
    { label: "Pending ID Verifications", value: stats.pendingVerifications ?? 0, color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", glow: "rgba(16,185,129,0.2)", icon: <Badge size={20} /> },
    { label: "Active Listings",          value: stats.active ?? 0,               color: "#0ea5e9", bg: "rgba(14,165,233,0.1)", border: "rgba(14,165,233,0.3)", glow: "rgba(14,165,233,0.2)", icon: <Activity size={20} /> },
    { label: "Open Content Flags",       value: stats.openFlags ?? 0,            color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  glow: "rgba(239,68,68,0.2)",  icon: <Flag size={20} /> },
    { label: "Reliability Index",        value: `${stats.verifiedPct ?? 0}%`,    color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", glow: "rgba(245,158,11,0.2)", icon: <Shield size={20} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "24px 0 80px", fontFamily: "'Space Grotesk','Inter',sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Header ── */}
        <div style={{ paddingTop: 8 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 9999, background: "rgba(255,255,255,0.8)", border: "1px solid rgba(16,185,129,0.3)", boxShadow: "0 2px 10px rgba(0,255,163,0.15)", marginBottom: 12 }}>
            <span className="pulse-dot" style={{ width: 8, height: 8 }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#065f46", textTransform: "uppercase" }}>SEC-GOV Kernel Active</span>
            <span style={{ color: "#d1d5db" }}>|</span>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--st-muted-dim)" }}>NODE-SYNC 99.98%</span>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 700, color: "var(--st-navy)", letterSpacing: "-0.02em", marginBottom: 6 }}>
            Campus Administration Console
          </h1>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: "var(--st-muted)", maxWidth: 600 }}>
            Real-time governance, student ID approvals, and listing moderation across distributed academic hardware nodes.
          </p>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {STAT_CARDS.map((s) => (
            <div key={s.label} className="stat-stitch" style={{ boxShadow: `0 12px 32px -8px ${s.glow}` }}>
              <div style={{ position: "absolute", right: -32, top: -32, width: 112, height: 112, background: s.bg, borderRadius: "50%", filter: "blur(20px)", transition: "all 0.3s ease" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-muted-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</span>
                <span style={{ padding: 8, borderRadius: 12, background: s.bg, border: `1px solid ${s.border}`, color: s.color, display: "flex" }}>{s.icon}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 36, fontWeight: 700, color: s.color, lineHeight: 1, letterSpacing: "-0.02em" }}>{s.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 6, padding: 6, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(195,192,255,0.4)", borderRadius: 9999, backdropFilter: "blur(12px)", maxWidth: "fit-content" }}>
          {TABS.map((t) => {
            const count = t.id === "verifications" ? pendingVerifications.length : t.id === "flags" ? flags.length : flaggedUsers.length;
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding: "8px 20px", borderRadius: 9999, border: "none", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s ease",
                  background: active ? "linear-gradient(135deg, var(--st-mint), var(--st-cyan), rgba(99,102,241,0.8))" : "transparent",
                  color: active ? "var(--st-navy)" : "var(--st-muted)",
                  boxShadow: active ? "0 2px 12px rgba(0,255,163,0.35)" : "none" }}>
                {t.icon} {t.label}
                {count > 0 && (
                  <span style={{ padding: "1px 8px", borderRadius: 9999, background: active ? "rgba(0,0,0,0.15)" : t.id === "flags" ? "#ef4444" : "var(--st-indigo)", color: "#fff", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700 }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ── */}
        {activeTab === "verifications" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--st-navy)" }}>ID Verification Queue</h2>
              <span style={{ padding: "3px 12px", borderRadius: 9999, background: "linear-gradient(135deg,rgba(0,255,163,0.15),rgba(0,229,255,0.1))", border: "1px solid rgba(0,255,163,0.3)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.06em" }}>Priority Triage</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <span className="pulse-dot" style={{ width: 8, height: 8 }} />
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, color: "var(--st-muted-dim)" }}>Auto-OCR: Enabled</span>
              </div>
            </div>
            {pendingVerifications.length === 0 ? (
              <div className="glass-holo" style={{ padding: 40 }}><EmptyState icon="✅" title="ID Queue Clear" sub="All registered students have been verified!" /></div>
            ) : (
              pendingVerifications.map((user) => (
                <div key={user.id} className="glass-holo" style={{ padding: 24 }}>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    {/* Left: info */}
                    <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 12px", borderRadius: 9999, background: "rgba(238,242,255,0.8)", border: "1px solid rgba(195,192,255,0.4)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-indigo)" }}>🎓 {user.department || "College"}</span>
                        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, color: "var(--st-muted-dim)" }}>Pending verification</span>
                      </div>
                      <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: "var(--st-navy)" }}>{user.name}</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "14px", borderRadius: 14, background: "linear-gradient(135deg,rgba(248,250,255,0.9),rgba(238,242,255,0.6))", border: "1px solid rgba(195,192,255,0.3)" }}>
                        {[["USN", user.usn], ["Department", user.department], ["Year", user.year], ["Email", user.email]].map(([k, v]) => (
                          <div key={k}>
                            <span style={{ display: "block", fontFamily: "'Space Grotesk',sans-serif", fontSize: 9, fontWeight: 700, color: "var(--st-muted-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{k}</span>
                            <span style={{ fontFamily: k === "Email" ? "'Inter',sans-serif" : "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: k === "Email" ? "var(--st-indigo)" : "var(--st-navy)", wordBreak: "break-all" }}>{v || "—"}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => handleVerify(user.id)} style={{ flex: 1, padding: "10px 16px", borderRadius: 9999, background: "linear-gradient(135deg,#34d399,#10b981)", color: "#022c22", fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>
                          <CheckCircle size={16} /> Approve USN
                        </button>
                        <button onClick={() => handleReject(user.id)} style={{ padding: "10px 20px", borderRadius: 9999, background: "rgba(254,242,242,0.9)", border: "1px solid rgba(252,165,165,0.6)", color: "#dc2626", fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </div>
                    {/* Right: ID photo */}
                    <div style={{ width: 224, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ position: "relative", width: "100%", height: 176, borderRadius: 14, overflow: "hidden", background: "#0f172a", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {user.id_photo_data ? (
                          <img src={user.id_photo_data} alt="College ID" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "rgba(255,255,255,0.4)" }}>
                            <ShieldCheck size={32} />
                            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 600 }}>No ID Uploaded</span>
                          </div>
                        )}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)", pointerEvents: "none" }} />
                        <span style={{ position: "absolute", top: 8, right: 8, padding: "3px 10px", borderRadius: 9999, background: "rgba(16,185,129,0.9)", backdropFilter: "blur(8px)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 9, fontWeight: 700, color: "#fff" }}>ID UPLOADED</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--st-muted-dim)" }}>Ref: #{user.id.slice(0, 8).toUpperCase()}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "#10b981" }}>
                          <span className="pulse-dot" style={{ width: 6, height: 6 }} /> Encrypted PII
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "flags" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--st-navy)" }}>Flagged Content</h2>
              <span className="pulse-dot pulse-dot--rose" style={{ width: 10, height: 10 }} />
              <span style={{ marginLeft: "auto", padding: "3px 12px", borderRadius: 9999, background: "rgba(254,242,242,0.9)", border: "1px solid rgba(252,165,165,0.4)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.06em" }}>Requires Action</span>
            </div>
            {flags.length === 0 ? (
              <div className="glass-holo" style={{ padding: 40 }}><EmptyState icon="✅" title="Queue is clear" sub="No flagged listings right now." /></div>
            ) : (
              flags.map((f) => (
                <div key={f.id} className="glass-holo" style={{ padding: 20, borderLeft: `4px solid ${f.severity === "high" ? "#ef4444" : f.severity === "low" ? "#0ea5e9" : "#f59e0b"}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ padding: "3px 12px", borderRadius: 9999, background: f.severity === "high" ? "rgba(239,68,68,0.1)" : f.severity === "low" ? "rgba(14,165,233,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${f.severity === "high" ? "rgba(239,68,68,0.3)" : f.severity === "low" ? "rgba(14,165,233,0.3)" : "rgba(245,158,11,0.3)"}`, color: f.severity === "high" ? "#dc2626" : f.severity === "low" ? "#0284c7" : "#d97706", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                          {f.severity} severity
                        </span>
                      </div>
                      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 700, color: "var(--st-navy)", marginBottom: 4 }}>{f.item_name}</div>
                      <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--st-muted-dim)", lineHeight: 1.5 }}>{f.reason}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => resolve(f.id, "remove")} style={{ padding: "8px 18px", borderRadius: 9999, background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 16px rgba(239,68,68,0.3)" }}>
                        <Trash2 size={13} /> Remove
                      </button>
                      <button onClick={() => resolve(f.id, "clear")} style={{ padding: "8px 18px", borderRadius: 9999, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(195,192,255,0.4)", color: "var(--st-muted)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "reliability" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--st-navy)" }}>Reliability Flags &amp; Disciplinary Track</h2>
            <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(254,252,232,0.8)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
                These buyers have reached 3+ no-shows. This is a review flag only — no automated action has been taken. Contact the student directly or escalate.
              </p>
            </div>
            {flaggedUsers.length === 0 ? (
              <div className="glass-holo" style={{ padding: 40 }}><EmptyState icon="✅" title="No reliability flags" sub="No buyers have exceeded the no-show threshold." /></div>
            ) : (
              flaggedUsers.map((u) => (
                <div key={u.id} className="glass-holo" style={{ padding: 20, borderLeft: "4px solid #f59e0b" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#ef4444,#f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                        {u.name?.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, color: "var(--st-navy)" }}>{u.name}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--st-muted-dim)" }}>{u.usn} · {u.department}</div>
                        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "var(--st-muted-dim)" }}>{u.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ padding: "4px 14px", borderRadius: 9999, background: "rgba(254,242,242,0.9)", border: "1px solid rgba(252,165,165,0.4)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
                        ⚠ {u.no_show_count} no-show{u.no_show_count !== 1 ? "s" : ""}
                      </span>
                      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, color: "var(--st-muted-dim)" }}>⭐ {Number(u.rating_avg || 0).toFixed(1)} ({u.rating_count})</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Mesh status bar */}
        <div className="glass-holo" style={{ padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: "linear-gradient(135deg,#34d399,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 20px rgba(16,185,129,0.3)" }}>
              <ShieldCheck size={22} color="#022c22" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.08em" }}>Live Mesh Telemetry</span>
                <span className="pulse-dot" style={{ width: 8, height: 8 }} />
              </div>
              <h4 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, color: "var(--st-navy)", marginBottom: 2 }}>16 Distributed Campus Nodes Synchronized</h4>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "var(--st-muted-dim)" }}>Current consensus latency: 12ms · Zero pending hardware disputes in last 24h</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: -8 }}>
            {["ECE", "CS", "ROB", "+13"].map((n, i) => (
              <div key={n} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #fff", background: i === 3 ? "linear-gradient(135deg,var(--st-mint),var(--st-cyan))" : "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: i === 3 ? "var(--st-navy)" : "var(--st-muted)", marginLeft: i === 0 ? 0 : -8, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                {n}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
