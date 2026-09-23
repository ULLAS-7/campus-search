import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, Trash2, CheckCircle, XCircle, UserCheck, UserX } from "lucide-react";
import { api } from "../api";
import { Badge } from "../components/common/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { Skeleton } from "../components/common/Skeleton";

export function AdminPanel() {
  const [stats, setStats] = useState({});
  const [flags, setFlags] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [flaggedUsers, setFlaggedUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("verifications"); // 'verifications' | 'flags' | 'reliability'
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, f, p] = await Promise.all([
        api.adminStats(),
        api.adminFlags(),
        api.getPendingVerifications(),
      ]);
      setStats(s);
      setFlags(f);
      setPendingVerifications(p);
      // Load flagged users separately — ignore errors (column may not exist on old DB)
      try {
        const fu = await api.getFlaggedUsers();
        setFlaggedUsers(Array.isArray(fu) ? fu : []);
      } catch (_) {
        setFlaggedUsers([]);
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action) => {
    await api.resolveFlag(id, action);
    load();
  };

  const handleVerify = async (id) => {
    try {
      await api.verifyUser(id);
      load();
    } catch (e) {
      alert("Failed to verify user: " + e.message);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("Enter reason for rejection:");
    if (reason === null) return;
    try {
      await api.rejectUser(id, reason);
      load();
    } catch (e) {
      alert("Failed to reject user: " + e.message);
    }
  };

  if (loading) return <Skeleton type="card" count={3} />;

  return (
    <div className="page-enter">
      <div className="section-header">
        <h2 className="section-title"><ShieldCheck size={22} color="var(--signal)" /> Moderation & ID Verification</h2>
      </div>

      <div className="stats-grid" style={{ marginBottom: 28 }}>
        {[
          { label: "Pending ID Verifications", value: stats.pendingVerifications ?? "0", color: "var(--signal)" },
          { label: "Active Listings", value: stats.active ?? "0", color: "var(--blue)" },
          { label: "Flagged Listings", value: stats.openFlags ?? "0", color: "var(--red)" },
          { label: "Verified Students", value: `${stats.verifiedPct ?? "0"}%`, color: "var(--amber)" },
        ].map((s) => (
          <div key={s.label} className="card card-glow stat-card">
            <div className="stat-card__value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--trace)", marginBottom: "20px" }}>
        <button
          className={`btn ${activeTab === "verifications" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("verifications")}
          style={{ borderRadius: "var(--radius-md) var(--radius-md) 0 0" }}
        >
          <UserCheck size={14} /> ID Verification Queue ({pendingVerifications.length})
        </button>
        <button
          className={`btn ${activeTab === "flags" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("flags")}
          style={{ borderRadius: "var(--radius-md) var(--radius-md) 0 0" }}
        >
          <ShieldAlert size={14} /> Flagged Content ({flags.length})
        </button>
        <button
          className={`btn ${activeTab === "reliability" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("reliability")}
          style={{ borderRadius: "var(--radius-md) var(--radius-md) 0 0" }}
        >
          <UserX size={14} /> Reliability Flags ({flaggedUsers.length})
        </button>
      </div>

      {activeTab === "verifications" ? (
        <div>
          {pendingVerifications.length === 0 ? (
            <div className="card">
              <EmptyState icon="✅" title="ID Queue Clear" sub="All registered students have been verified!" />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {pendingVerifications.map((user) => (
                <div key={user.id} className="card" style={{ padding: "16px", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <h4 style={{ fontSize: "16px" }}>{user.name}</h4>
                      <p style={{ fontSize: "12px", color: "var(--signal)", fontWeight: "600" }}>USN: {user.usn}</p>
                      <p style={{ fontSize: "12px", color: "var(--muted)" }}>{user.department} · {user.year}</p>
                      <p style={{ fontSize: "11px", color: "var(--muted-dim)" }}>{user.email}</p>
                    </div>
                    <Badge tone="amber">Pending Approval</Badge>
                  </div>

                  {user.id_photo_data ? (
                    <div style={{ background: "var(--raised)", padding: "8px", borderRadius: "var(--radius-md)", textAlign: "center", marginBottom: "14px" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Uploaded College ID Photo:</span>
                      <img src={user.id_photo_data} alt="College ID" style={{ maxHeight: "160px", maxWidth: "100%", borderRadius: "var(--radius-sm)", objectFit: "contain" }} />
                    </div>
                  ) : (
                    <div style={{ background: "var(--raised)", padding: "16px", textAlign: "center", borderRadius: "var(--radius-md)", color: "var(--muted)", fontSize: "12px", marginBottom: "14px" }}>
                      No ID photo uploaded
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleVerify(user.id)}>
                      <CheckCircle size={14} /> Approve Verified
                    </button>
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleReject(user.id)}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "flags" ? (
        <div>
          {flags.length === 0 ? (
            <div className="card">
              <EmptyState icon="✅" title="Queue is clear" sub="No flagged listings right now." />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {flags.map((f) => (
                <div key={f.id} className="card card-hover" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <Badge tone={f.severity === "high" ? "red" : "amber"}>{f.severity} risk</Badge>
                    <div style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>{f.item_name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{f.reason}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => resolve(f.id, "remove")} className="btn btn-danger" style={{ padding: "8px 14px", fontSize: 12 }}><Trash2 size={13} /> Remove</button>
                    <button onClick={() => resolve(f.id, "clear")} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12 }}>Clear</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Reliability Flags tab — read-only, no actions ── */
        <div>
          <div className="alert alert--warn" style={{ marginBottom: 16 }}>
            <AlertTriangle size={15} className="alert__icon" />
            <div>
              These buyers have reached {3}+ no-shows. This is a review flag only — no automated action has been taken.
              Contact the student directly or escalate through your institution's process.
            </div>
          </div>
          {flaggedUsers.length === 0 ? (
            <div className="card">
              <EmptyState icon="✅" title="No reliability flags" sub="No buyers have exceeded the no-show threshold." />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {flaggedUsers.map((u) => (
                <div key={u.id} className="card" style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {u.department} · {u.year} · USN: {u.usn}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted-dim)", marginTop: 1 }}>{u.email}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Badge tone="red">{u.no_show_count} no-show{u.no_show_count !== 1 ? "s" : ""}</Badge>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>⭐ {Number(u.rating_avg || 0).toFixed(1)} ({u.rating_count})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="alert alert--warn" style={{ marginTop: 24 }}>
        <AlertTriangle size={15} className="alert__icon" />
        <div>All identity verifications require checking the student's USN and uploaded ID card photo. Approved users receive a green Verified badge on listings.</div>
      </div>
    </div>
  );
}
