import React, { useState } from "react";
import { Cpu, Upload, ShieldCheck, Camera, Eye, EyeOff } from "lucide-react";
import { api, setToken } from "../../api";

export function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    year: "",
    usn: "",
    id_photo_data: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((f) => ({ ...f, id_photo_data: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        if (!form.usn.trim()) throw new Error("USN / Roll number is required.");
      }

      let res;
      if (mode === "login") {
        res = await api.login({ email: form.email, password: form.password });
      } else if (mode === "forgot") {
        res = await api.resetPassword({ email: form.email, phone: form.phone, newPassword: form.password });
        alert("Password reset successfully!");
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

  const handleKeyDown = (e) => { if (e.key === "Enter" && mode !== "register") submit(); };

  return (
    <div className="auth-wrapper">
      <div className="card card-glow auth-card" style={{ maxWidth: mode === "register" ? "520px" : "400px" }}>
        <div className="auth-card__header">
          <div className="navbar__logo"><Cpu size={16} color="#060a08" /></div>
          <div>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>CampusSearch</span>
            <span className="navbar__version" style={{ marginLeft: 8 }}>v2.0</span>
          </div>
        </div>
        <div className="auth-card__subtitle">Campus peer-to-peer hardware exchange & verified student identity.</div>

        <div className="auth-tabs">
          <button onClick={() => setMode("login")} className={`auth-tab ${(mode === "login" || mode === "forgot") ? "auth-tab--active" : ""}`}>Log in</button>
          <button onClick={() => setMode("register")} className={`auth-tab ${mode === "register" ? "auth-tab--active" : ""}`}>Register</button>
        </div>

        {mode === "login" && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            <button
              type="button"
              id="demo-student-btn"
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: "11.5px", padding: "7px 10px", borderColor: "var(--signal)", color: "var(--signal)" }}
              onClick={async () => {
                setError(""); setLoading(true);
                try {
                  const res = await api.login({ email: "aravind.k@college.edu", password: "demo1234" });
                  setToken(res.token); onAuthed();
                } catch (e) { setError(e.message); } finally { setLoading(false); }
              }}
            >
              ⚡ Demo Student
            </button>
            <button
              type="button"
              id="demo-admin-btn"
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: "11.5px", padding: "7px 10px", borderColor: "var(--signal)", color: "var(--signal)" }}
              onClick={async () => {
                setError(""); setLoading(true);
                try {
                  const res = await api.login({ email: "admin@college.edu", password: "demo1234" });
                  setToken(res.token); onAuthed();
                } catch (e) { setError(e.message); } finally { setLoading(false); }
              }}
            >
              🛡️ Demo Admin
            </button>
          </div>
        )}

        <div className="auth-form" onKeyDown={handleKeyDown}>
          {mode === "register" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input className="input" placeholder="Full Name *" value={form.name} onChange={set("name")} id="auth-name" required />
                <input className="input" placeholder="USN / Roll No *" value={form.usn} onChange={set("usn")} id="auth-usn" required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input className="input" placeholder="Phone Number" value={form.phone} onChange={set("phone")} id="auth-phone" />
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="input" placeholder="Dept (e.g. ECE)" value={form.department} onChange={set("department")} id="auth-dept" />
                  <input className="input" style={{ maxWidth: 80 }} placeholder="Year" value={form.year} onChange={set("year")} id="auth-year" />
                </div>
              </div>

              {/* ID Photo Upload */}
              <div className="id-upload-box" onClick={() => document.getElementById("id-photo-input").click()}>
                <input
                  type="file"
                  id="id-photo-input"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                />
                {form.id_photo_data ? (
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--signal)", fontWeight: "600" }}>✓ College ID Uploaded</span>
                    <img src={form.id_photo_data} alt="ID Preview" className="id-preview-img" />
                  </div>
                ) : (
                  <div>
                    <Camera size={24} color="var(--muted)" style={{ marginBottom: "6px" }} />
                    <p style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "600" }}>
                      Upload College ID Card Photo (Optional)
                    </p>

                    <span style={{ fontSize: "11px", color: "var(--muted-dim)" }}>
                      Required for identity verification by campus admin
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {mode === "forgot" && (
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8, padding: "8px", background: "var(--raised)", borderRadius: 6 }}>
              Enter your registered Email and Phone Number to reset your password.
            </div>
          )}

          <input className="input" placeholder="Email Address *" value={form.email} onChange={set("email")} id="auth-email" required />
          
          {mode === "forgot" && (
            <input className="input" placeholder="Registered Phone Number *" value={form.phone} onChange={set("phone")} required />
          )}

          <div style={{ position: "relative" }}>
            <input className="input" type={showPassword ? "text" : "password"} placeholder={mode === "forgot" ? "New Password *" : "Password *"} value={form.password} onChange={set("password")} id="auth-password" required style={{ width: "100%", paddingRight: "40px" }} />
            <button 
              type="button" 
              className="btn-ghost" 
              onClick={() => setShowPassword(!showPassword)} 
              style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", padding: "4px", color: "var(--muted)" }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          
          {mode === "login" && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-4px" }}>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ fontSize: 12, padding: "2px 4px" }}
                onClick={() => setMode("forgot")}
              >
                Forgot Password?
              </button>
            </div>
          )}
          {mode === "forgot" && (
             <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-4px" }}>
             <button 
               type="button" 
               className="btn-ghost" 
               style={{ fontSize: 12, padding: "2px 4px" }}
               onClick={() => setMode("login")}
             >
               Back to Login
             </button>
           </div>
          )}
        </div>

        {error && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 10 }}>{error}</div>}

        <button onClick={submit} disabled={loading} className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} id="auth-submit">
          {loading ? "Please wait…" : mode === "login" ? "Log in" : mode === "forgot" ? "Reset Password" : "Register Account"}
        </button>

        <div className="auth-footer" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={14} color="var(--signal)" />
          <span>Identity verified via USN & Student ID photo approval by admin.</span>
        </div>
      </div>
    </div>
  );
}
