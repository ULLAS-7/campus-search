import React, { useState } from "react";
import { Eye, EyeOff, ShieldCheck, ArrowRight, Zap, Shield, Cpu, Camera } from "lucide-react";
import { api, setToken } from "../../api";

export function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", phone: "", department: "", year: "",
    usn: "", id_photo_data: "", password: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setForm((f) => ({ ...f, id_photo_data: reader.result }));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      let res;
      if (mode === "login") {
        res = await api.login({ email: form.email, password: form.password });
      } else if (mode === "forgot") {
        res = await api.resetPassword({ email: form.email, phone: form.phone, newPassword: form.password });
      } else {
        res = await api.register(form);
      }
      setToken(res.token);
      onAuthed();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (email) => {
    setError(""); setLoading(true);
    try {
      const res = await api.login({ email, password: "demo1234" });
      setToken(res.token); onAuthed();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-stitch" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", fontFamily: "'Space Grotesk','Inter',sans-serif", position: "relative", overflow: "hidden" }}>

      {/* Ambient blobs */}
      <div style={{ position: "fixed", top: -128, left: -80, width: 384, height: 384, borderRadius: "50%", background: "rgba(0,229,255,0.2)", filter: "blur(80px)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -128, right: -80, width: 448, height: 448, borderRadius: "50%", background: "rgba(99,102,241,0.15)", filter: "blur(80px)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 672, height: 672, borderRadius: "50%", background: "rgba(0,255,163,0.08)", filter: "blur(100px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 520, position: "relative", zIndex: 1 }}>

        {/* Top status bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", marginBottom: 12, background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pulse-dot" style={{ width: 10, height: 10 }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--st-muted)", textTransform: "uppercase" }}>SSO Node // Lab-09 Online</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, color: "var(--st-muted-dim)" }}>
            <span>Latency 12ms</span>
            <span style={{ color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>🔒 Encrypted 256-Bit</span>
          </div>
        </div>

        {/* Main card */}
        <div className="glass-holo" style={{ padding: "clamp(24px,5vw,40px)", position: "relative", overflow: "hidden" }}>
          {/* Top gradient bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, var(--st-mint), var(--st-cyan), #6366f1, #8b5cf6)" }} />

          {/* Brand */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 28 }}>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,255,163,0.3)", filter: "blur(20px)", borderRadius: "50%", transform: "scale(1.3)" }} />
              <div style={{ position: "relative", width: 64, height: 64, borderRadius: 16, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(0,255,163,0.3)", boxShadow: "0 8px 24px rgba(0,255,163,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Cpu size={32} color="var(--st-indigo)" />
              </div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 9999, background: "var(--st-container)", border: "1px solid rgba(255,255,255,0.8)", marginBottom: 10 }}>
              <ShieldCheck size={13} color="#10b981" />
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>CampusSearch SSO Gateway</span>
              <span style={{ padding: "1px 8px", borderRadius: 9999, background: "linear-gradient(135deg,rgba(0,255,163,0.3),rgba(0,229,255,0.2))", border: "1px solid rgba(0,255,163,0.3)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 9, fontWeight: 700, color: "var(--st-indigo)" }}>v2.4 PRO</span>
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: "var(--st-navy)", letterSpacing: "-0.01em", marginBottom: 6 }}>Institutional Access Protocol</h1>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--st-muted)", maxWidth: 340, lineHeight: 1.6 }}>Authenticate with your accredited university USN credentials to reserve testbenches, microcontrollers, and campus lab inventory.</p>
          </div>

          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(238,242,255,0.8)", borderRadius: 9999, marginBottom: 20, border: "1px solid rgba(255,255,255,0.7)" }}>
            {[{ id: "login", label: "Log in" }, { id: "register", label: "Register" }].map((t) => (
              <button key={t.id} onClick={() => { setMode(t.id); setError(""); }}
                style={{ flex: 1, padding: "10px", borderRadius: 9999, border: "none", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, transition: "all 0.2s ease",
                  background: mode === t.id ? "rgba(255,255,255,1)" : "transparent",
                  color: mode === t.id ? "var(--st-indigo)" : "var(--st-muted-dim)",
                  boxShadow: mode === t.id ? "0 2px 8px rgba(99,102,241,0.15)" : "none",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Demo buttons */}
          {mode === "login" && (
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 16, background: "rgba(238,242,255,0.7)", border: "1px solid rgba(255,255,255,0.7)", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-muted-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>⚡ Sandbox Quick Fill</span>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, color: "#10b981", fontWeight: 700 }}>1-Click Auto Login</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={() => demoLogin("aravind.k@college.edu")} disabled={loading}
                  style={{ padding: "10px 16px", borderRadius: 9999, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,255,163,0.4)", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, color: "var(--st-navy)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s ease", boxShadow: "0 2px 8px rgba(0,255,163,0.15)" }}>
                  <Zap size={14} color="var(--st-mint)" /> Demo Student
                </button>
                <button onClick={() => demoLogin("admin@college.edu")} disabled={loading}
                  style={{ padding: "10px 16px", borderRadius: 9999, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, color: "var(--st-navy)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s ease", boxShadow: "0 2px 8px rgba(99,102,241,0.15)" }}>
                  <Shield size={14} color="var(--st-indigo)" /> Demo Admin
                </button>
              </div>
            </div>
          )}

          {/* Form fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Register extra fields */}
            {mode === "register" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-muted-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Full Name *</label>
                    <input className="input-stitch" placeholder="e.g. Aravind K" value={form.name} onChange={set("name")} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-muted-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>USN / Roll No *</label>
                    <input className="input-stitch" placeholder="1MS21EC042" value={form.usn} onChange={set("usn")} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input className="input-stitch" placeholder="Phone Number" value={form.phone} onChange={set("phone")} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input-stitch" placeholder="Dept (e.g. ECE)" value={form.department} onChange={set("department")} />
                    <input className="input-stitch" placeholder="Year" style={{ maxWidth: 80 }} value={form.year} onChange={set("year")} />
                  </div>
                </div>
                <div className="id-upload-box" onClick={() => document.getElementById("id-photo-stitch").click()}>
                  <input type="file" id="id-photo-stitch" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                  {form.id_photo_data ? (
                    <>
                      <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>✓ College ID Uploaded</span>
                      <img src={form.id_photo_data} alt="ID" className="id-preview-img" />
                    </>
                  ) : (
                    <>
                      <Camera size={24} color="var(--st-muted-dim)" style={{ margin: "0 auto 8px" }} />
                      <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--st-muted)", marginBottom: 4 }}>Upload College ID Card Photo (Optional)</p>
                      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "var(--st-muted-dim)" }}>Required for identity verification by campus admin</span>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Forgot mode info */}
            {mode === "forgot" && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(238,242,255,0.8)", border: "1px solid rgba(195,192,255,0.4)", fontFamily: "'Inter',sans-serif", fontSize: 13, color: "var(--st-muted)" }}>
                Enter your registered Email and Phone Number to reset your password.
              </div>
            )}

            {/* Email */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-muted-dim)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {mode === "register" ? "Email Address *" : "Campus Email"}
                </label>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, color: "#10b981", fontWeight: 700 }}>✓ Domain Verified</span>
              </div>
              <input className="input-stitch" type="email" placeholder="1MS21CS042@campus.edu" value={form.email} onChange={set("email")} onKeyDown={(e) => e.key === "Enter" && mode === "login" && submit()} />
            </div>

            {/* Phone (forgot only) */}
            {mode === "forgot" && (
              <div>
                <label style={{ display: "block", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-muted-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Registered Phone *</label>
                <input className="input-stitch" placeholder="9876543210" value={form.phone} onChange={set("phone")} />
              </div>
            )}

            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-muted-dim)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {mode === "forgot" ? "New Password *" : "Security Key / Password"}
                </label>
                {mode === "login" && (
                  <button onClick={() => setMode("forgot")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, color: "var(--st-indigo)", fontWeight: 600 }}>Forgot key?</button>
                )}
                {mode === "forgot" && (
                  <button onClick={() => setMode("login")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, color: "var(--st-indigo)", fontWeight: 600 }}>Back to Login</button>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input className="input-stitch" type={showPassword ? "text" : "password"} placeholder="••••••••••••" value={form.password} onChange={set("password")} onKeyDown={(e) => e.key === "Enter" && mode === "login" && submit()} style={{ paddingRight: 48 }} />
                <button onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--st-muted-dim)" }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#ef4444", padding: "8px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</div>}

            {/* Submit button */}
            <button onClick={submit} disabled={loading}
              style={{ width: "100%", padding: "16px 24px", borderRadius: 9999, background: "linear-gradient(135deg, #00f5a0, #00c8ff, #6366f1)", color: "var(--st-navy)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, border: "none", cursor: loading ? "wait" : "pointer", boxShadow: "0 8px 30px rgba(0,229,255,0.3), 0 0 12px rgba(99,102,241,0.2)", transition: "all 0.2s ease", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
              {loading ? "Verifying Campus Identity..." : mode === "login" ? "Log in to Campus" : mode === "forgot" ? "Reset Password" : "Register Campus Account"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </div>

          {/* Trust badge */}
          <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,rgba(0,255,163,0.2),rgba(0,229,255,0.2))", border: "1px solid rgba(0,255,163,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ShieldCheck size={18} color="#10b981" />
            </div>
            <div>
              <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, color: "var(--st-navy)", marginBottom: 2 }}>Hardware Escrow & ID Attestation</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "var(--st-muted-dim)", lineHeight: 1.5 }}>Identity verified via USN & College Smart Card. Anti-theft physical escrow protection on all peer transactions.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "16px", fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, color: "var(--st-muted-dim)", fontWeight: 600, letterSpacing: "0.05em" }}>
          <span>CAMPUS SEARCH PROTOCOL © 2025</span>
        </div>
      </div>
    </div>
  );
}
