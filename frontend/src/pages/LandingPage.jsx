import React from "react";
import { ShieldCheck, Radar, MapPin, QrCode, ArrowRight, Zap, Users, BadgeCheck, Star, Cpu, Search } from "lucide-react";

const FEATURES = [
  {
    step: "01",
    icon: <ShieldCheck size={28} />,
    title: "Verified Institutional Identity",
    desc: "Zero anonymous spammers. Direct identity verification through your College USN registry and institutional .edu email ensures every hardware trader is an enrolled university peer.",
    checks: ["Automated USN Match", "Zero Personal Phone Exposure"],
    color: "var(--st-mint)",
    glow: "rgba(0,255,163,0.35)",
  },
  {
    step: "02",
    icon: <Search size={28} />,
    title: "Find or Broadcast Hardware",
    desc: "Discover oscilloscopes, logic gates, sensors, or FPGA evaluation rigs sitting idle across neighboring labs. Need an urgent component? Dispatch a campus-wide Wanted Radar alert in 10 seconds.",
    checks: ["Live Lab Mesh Index", "Reverse Wanted Alerts"],
    color: "var(--st-indigo)",
    glow: "rgba(99,102,241,0.3)",
  },
  {
    step: "03",
    icon: <MapPin size={28} />,
    title: "Meet & Bench-Test In Person",
    desc: "Skip risky shipping and counterfeit worries. Convenient safe-zone meeting coordinates at Central Library commons allow instant multimeter checks before agreement.",
    checks: ["Maker Lab Test Benches", "Instant Continuity Checks"],
    color: "var(--st-indigo)",
    glow: "rgba(99,102,241,0.3)",
  },
  {
    step: "04",
    icon: <QrCode size={28} />,
    title: "Seamless UPI or Free Borrowing",
    desc: "Scan instant peer UPI QR codes with zero intermediary commission fees. Or tap into community-donated hardware pools with zero-fee academic borrowing backed by digital return receipts.",
    checks: ["0% Fee UPI Handshake", "Digital Collateral Vault"],
    color: "var(--st-mint)",
    glow: "rgba(0,255,163,0.35)",
  },
];

const STATS = [
  { icon: <Zap size={20} />, value: "500+", label: "Components", color: "var(--st-mint)" },
  { icon: <Users size={20} />, value: "200+", label: "Makers", color: "var(--st-indigo)" },
  { icon: <BadgeCheck size={20} />, value: "100%", label: "Campus USN", color: "var(--st-mint)" },
  { icon: <Star size={20} />, value: "4.9/5", label: "Lab Trust", color: "#f59e0b" },
];

export function LandingPage({ onGetStarted }) {
  return (
    <div className="bg-stitch" style={{ minHeight: "100vh", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
      {/* Ambient blobs */}
      <div style={{ position: "fixed", top: -128, left: "50%", transform: "translateX(-50%)", width: 900, height: 520, background: "radial-gradient(ellipse, rgba(0,255,163,0.12) 0%, rgba(0,229,255,0.1) 40%, rgba(99,102,241,0.08) 100%)", filter: "blur(80px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: 200, right: 40, width: 384, height: 384, background: "rgba(0,255,163,0.1)", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: 100, left: 20, width: 320, height: 320, background: "rgba(139,92,246,0.1)", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none", zIndex: 0 }} />

      {/* ── HERO ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", padding: "100px 24px 80px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>

        {/* Live tag */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 20px", borderRadius: 9999, background: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 16px rgba(0,255,163,0.2)", backdropFilter: "blur(12px)", marginBottom: 32 }}>
          <span className="pulse-dot" />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "var(--st-navy)", textTransform: "uppercase" }}>
            Academic Hardware Mesh // Semester Grid Active
          </span>
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(2.5rem,7vw,4.5rem)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "var(--st-navy)", marginBottom: 24 }}>
          Campus
          <span style={{ background: "linear-gradient(135deg, #00ffa3, #00c8ff, #6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Search
          </span>
        </h1>

        <p style={{ maxWidth: 600, fontSize: "clamp(1rem,2vw,1.125rem)", color: "var(--st-muted)", lineHeight: 1.7, marginBottom: 40, fontFamily: "'Inter', sans-serif" }}>
          The decentralized peer-to-peer campus hardware &amp; prototyping exchange. Borrow, trade, or inspect microcontrollers, test rigs, and silicon across campus laboratories instantly.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 56 }}>
          <button onClick={onGetStarted} className="btn-stitch-primary" style={{ fontSize: 16, padding: "16px 40px" }}>
            Join Your Campus <ArrowRight size={18} />
          </button>
          <button className="btn-stitch-secondary" style={{ fontSize: 15 }}>
            <Cpu size={18} style={{ color: "var(--st-indigo)" }} />
            Explore Inventory (450+ items)
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ width: "100%", maxWidth: 800, padding: "12px", borderRadius: 9999, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.8)", backdropFilter: "blur(20px)", boxShadow: "0 12px 40px rgba(99,102,241,0.08), 0 1px 3px rgba(0,255,163,0.12)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {STATS.map((s) => (
              <div key={s.label} style={{ padding: "12px 16px", borderRadius: 9999, background: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.9)", display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
                <span style={{ color: s.color, background: s.color + "22", padding: 6, borderRadius: "50%", display: "flex" }}>{s.icon}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: "var(--st-navy)", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 600, color: "var(--st-muted-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ display: "inline-block", padding: "6px 18px", borderRadius: 9999, background: "rgba(255,255,255,0.8)", border: "1px solid rgba(75,65,225,0.2)", color: "var(--st-indigo)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
            Protocol & Safety
          </span>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 700, color: "var(--st-navy)", letterSpacing: "-0.02em", marginBottom: 12 }}>How CampusSearch Operates</h2>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 16, color: "var(--st-muted)", maxWidth: 540, margin: "0 auto" }}>Four streamlined steps engineered for university student privacy, component authenticity, and rapid campus handoffs.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(480px,1fr))", gap: 24 }}>
          {FEATURES.map((f) => (
            <div key={f.step} className="glass-holo" style={{ padding: 32 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${f.color}33, ${f.color}11)`, border: `1px solid ${f.color}44`, display: "flex", alignItems: "center", justifyContent: "center", color: f.color, boxShadow: `0 4px 16px ${f.glow}`, flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: "var(--st-indigo)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>STEP {f.step}</div>
                  <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--st-navy)", marginBottom: 10, letterSpacing: "-0.01em" }}>{f.title}</h3>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: "var(--st-muted)", lineHeight: 1.65, marginBottom: 14 }}>{f.desc}</p>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {f.checks.map((c) => (
                      <span key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 600, color: "var(--st-muted)" }}>
                        <span style={{ color: "#10b981", fontSize: 14 }}>✓</span> {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", padding: "0 24px 80px" }}>
        <div className="glass-holo" style={{ padding: "48px 40px", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -60, bottom: -60, width: 320, height: 320, background: "rgba(0,255,163,0.15)", borderRadius: "50%", filter: "blur(60px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: -60, top: -60, width: 280, height: 280, background: "rgba(139,92,246,0.1)", borderRadius: "50%", filter: "blur(60px)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 20 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 9999, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.95)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 600, color: "var(--st-navy)" }}>
              <span className="pulse-dot" style={{ width: 8, height: 8 }} /> Distributed Lab Topology
            </span>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(1.4rem,3vw,1.875rem)", fontWeight: 700, color: "var(--st-navy)", letterSpacing: "-0.02em", maxWidth: 600 }}>
              Explore Active Hardware Nodes On Campus
            </h2>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: "var(--st-muted)", maxWidth: 520 }}>
              CampusSearch connects discrete research rooms, student hostels, and maker incubators into one synchronized hardware catalog.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {["ECE VLSI Wing (84 units)", "Mech Mechatronics Lab (42 units)", "Maker Incubator Block D (119 units)"].map((node, i) => (
                <span key={node} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 9999, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.8)", fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 600, color: "var(--st-navy)" }}>
                  <span className="pulse-dot" style={{ width: 8, height: 8, background: i === 0 ? "var(--st-mint)" : i === 1 ? "var(--st-indigo)" : "var(--st-cyan)", boxShadow: `0 0 6px ${i === 0 ? "var(--st-mint)" : i === 1 ? "var(--st-indigo)" : "var(--st-cyan)"}` }} />
                  {node}
                </span>
              ))}
            </div>
            <button onClick={onGetStarted} className="btn-stitch-primary" style={{ marginTop: 8 }}>
              Join Your Campus <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
