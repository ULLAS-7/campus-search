import React, { useState, useEffect, useRef } from "react";
import { X, Upload, Lightbulb, Camera } from "lucide-react";
import { api } from "../../api";
import { CATEGORIES } from "../../constants/categories";

const CONDITION_OPTIONS = [
  { value: "new",          label: "New (never used)" },
  { value: "like_new",     label: "Like New (minimal use)" },
  { value: "used_working", label: "Used – Working" },
  { value: "heavily_used", label: "Heavily Used" },
];

/* ── small inline style helpers ── */
const S = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(7,12,30,0.65)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 200, padding: 16,
    animation: "fadeIn 0.2s ease-out",
  },
  card: {
    position: "relative",
    width: "100%", maxWidth: 520,
    maxHeight: "90vh", overflowY: "auto",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.9)",
    boxShadow: "0 20px 50px -12px rgba(99,102,241,0.18), 0 0 40px -10px rgba(0,245,160,0.12)",
    padding: "clamp(20px,4vw,32px)",
    animation: "slideUp 0.3s ease-out",
    fontFamily: "'Space Grotesk','Inter',sans-serif",
  },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    background: "linear-gradient(90deg, #00ffa3, #00c8ff, #6366f1)",
    borderRadius: "20px 20px 0 0",
  },
  closeBtn: {
    position: "absolute", top: 14, right: 14,
    width: 32, height: 32, borderRadius: "50%",
    background: "rgba(238,242,255,0.8)", border: "1px solid rgba(195,192,255,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: "#64748b", transition: "all 0.15s ease",
  },
  label: {
    display: "block",
    fontFamily: "'Space Grotesk',sans-serif",
    fontSize: 10, fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: "0.07em",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 9999,
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(180,180,255,0.5)",
    color: "#070C1E",
    fontFamily: "'Inter',sans-serif",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.2s ease",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 9999,
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(180,180,255,0.5)",
    color: "#070C1E",
    fontFamily: "'Inter',sans-serif",
    fontSize: 13,
    outline: "none",
    appearance: "none",
    boxSizing: "border-box",
    transition: "all 0.2s ease",
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(180,180,255,0.5)",
    color: "#070C1E",
    fontFamily: "'Inter',sans-serif",
    fontSize: 13,
    outline: "none",
    resize: "vertical",
    minHeight: 80,
    boxSizing: "border-box",
    transition: "all 0.2s ease",
  },
  toggleBtn: (active) => ({
    flex: 1,
    padding: "10px 16px",
    borderRadius: 9999,
    border: active ? "none" : "1px solid rgba(180,180,255,0.4)",
    cursor: "pointer",
    fontFamily: "'Space Grotesk',sans-serif",
    fontSize: 13, fontWeight: 700,
    transition: "all 0.2s ease",
    background: active
      ? "linear-gradient(135deg, #00ffa3, #00c8ff, #6366f1)"
      : "rgba(255,255,255,0.9)",
    color: active ? "#070C1E" : "#64748b",
    boxShadow: active ? "0 4px 16px rgba(0,255,163,0.3)" : "none",
  }),
  submitBtn: (disabled) => ({
    width: "100%",
    padding: "14px 24px",
    borderRadius: 9999,
    background: disabled
      ? "rgba(200,200,220,0.5)"
      : "linear-gradient(135deg, #00f5a0, #00c8ff, #6366f1)",
    color: disabled ? "#94a3b8" : "#070C1E",
    fontFamily: "'Space Grotesk',sans-serif",
    fontSize: 15, fontWeight: 700,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 8px 30px rgba(0,229,255,0.3)",
    transition: "all 0.2s ease",
    marginTop: 4,
  }),
};

export function ListItemModal({ onClose, onCreated, editItem }) {
  const [form, setForm] = useState(editItem ? {
    item_name:       editItem.item_name,
    category:        editItem.category,
    condition:       editItem.condition       || "used_working",
    condition_notes: editItem.condition_notes || "",
    description:     editItem.description    || "",
    price:           editItem.price,
    quantity:        editItem.quantity,
    listing_type:    editItem.listing_type   || "sale",
    return_by:       editItem.return_by      || "",
    image_data:      editItem.image_data     || null,
  } : {
    item_name: "", category: CATEGORIES[0],
    condition: "used_working", condition_notes: "",
    description: "", price: "", quantity: "1",
    listing_type: "sale", return_by: "", image_data: null,
  });

  const [error,          setError]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [hintLoading,    setHintLoading]    = useState(false);
  const debounceRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.item_name && form.condition_notes;

  // Focus ring via JS (avoids adding class to every input)
  const focusStyle = { boxShadow: "0 0 0 3px rgba(0,229,255,0.25), 0 0 12px rgba(0,255,163,0.15)", borderColor: "#00c8ff" };
  const addFocus   = (e) => Object.assign(e.target.style, focusStyle);
  const remFocus   = (e) => { e.target.style.boxShadow = ""; e.target.style.borderColor = ""; };

  // Debounced price hint
  useEffect(() => {
    if (!form.item_name || form.item_name.length < 3) { setPriceSuggestion(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setHintLoading(true);
      try {
        const data = await api.suggestPrice({ item_name: form.item_name, category: form.category, condition: form.condition });
        setPriceSuggestion(data?.suggested_price ?? null);
      } catch (_) { setPriceSuggestion(null); }
      finally { setHintLoading(false); }
    }, 800);
    return () => clearTimeout(debounceRef.current);
  }, [form.item_name, form.category, form.condition]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError("Image too large (max 5MB)");
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, image_data: reader.result }));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const payload = { ...form, price: Number(form.price) || 0, quantity: Number(form.quantity) || 1 };
      if (editItem) { await api.updateListing(editItem.id, payload); }
      else          { await api.createListing(payload); }
      onCreated();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.card} onClick={(e) => e.stopPropagation()}>
        {/* Gradient top bar */}
        <div style={S.topBar} />

        {/* Close */}
        <button style={S.closeBtn} onClick={onClose}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(238,242,255,0.8)"; e.currentTarget.style.color = "#64748b"; }}>
          <X size={15} />
        </button>

        {/* Title */}
        <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: "#070C1E", marginBottom: 20, paddingTop: 4, paddingRight: 36 }}>
          {editItem ? "✏️ Edit Listing" : "📦 List a Component"}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Item name */}
          <div>
            <label style={S.label}>Item Name *</label>
            <input style={S.input} placeholder="e.g. Arduino Uno R3, ESP32 DevKit" value={form.item_name} onChange={set("item_name")}
              onFocus={addFocus} onBlur={remFocus} id="list-name" />
          </div>

          {/* Sale / Rent toggle */}
          <div>
            <label style={S.label}>Listing Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button style={S.toggleBtn(form.listing_type === "sale")} onClick={() => setForm((f) => ({ ...f, listing_type: "sale" }))}>💰 For Sale</button>
              <button style={S.toggleBtn(form.listing_type === "rent")} onClick={() => setForm((f) => ({ ...f, listing_type: "rent" }))}>⏱ For Rent/Borrow</button>
            </div>
          </div>

          {/* Condition enum dropdown */}
          <div>
            <label style={S.label}>Condition</label>
            <select style={S.select} value={form.condition} onChange={set("condition")} id="list-condition-enum"
              onFocus={addFocus} onBlur={remFocus}>
              {CONDITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Category + Price + Qty */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 8 }}>
            <div>
              <label style={S.label}>Category</label>
              <select style={S.select} value={form.category} onChange={set("category")} id="list-category"
                onFocus={addFocus} onBlur={remFocus}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>{form.listing_type === "rent" ? "Rental Fee (₹)" : "Price (₹)"}</label>
              <input style={S.input} type="number" placeholder="0" value={form.price} onChange={set("price")}
                onFocus={addFocus} onBlur={remFocus} id="list-price" />
            </div>
            <div>
              <label style={S.label}>Qty</label>
              <input style={S.input} type="number" min="1" placeholder="1" value={form.quantity} onChange={set("quantity")}
                onFocus={addFocus} onBlur={remFocus} id="list-quantity" />
            </div>
          </div>

          {/* Fair price hint */}
          {(hintLoading || priceSuggestion !== null) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(238,242,255,0.8)", border: "1px solid rgba(195,192,255,0.4)" }}>
              <Lightbulb size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
              {hintLoading ? (
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#94a3b8" }}>Calculating fair price…</span>
              ) : (
                <>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#334155", flex: 1 }}>
                    Fair price suggestion: <strong style={{ color: "#065f46" }}>₹{priceSuggestion}</strong>
                  </span>
                  <button onClick={() => setForm((f) => ({ ...f, price: String(priceSuggestion) }))}
                    style={{ padding: "4px 14px", borderRadius: 9999, background: "linear-gradient(135deg,#00ffa3,#00c8ff)", border: "none", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700, color: "#070C1E", flexShrink: 0 }}>
                    Use this price
                  </button>
                </>
              )}
            </div>
          )}

          {/* Return by (rent only) */}
          {form.listing_type === "rent" && (
            <div>
              <label style={S.label}>Return By</label>
              <input style={S.input} placeholder="e.g. End of Semester, 3 Days" value={form.return_by} onChange={set("return_by")}
                onFocus={addFocus} onBlur={remFocus} />
            </div>
          )}

          {/* Condition notes */}
          <div>
            <label style={S.label}>Condition Notes *</label>
            <input style={S.input} placeholder="e.g. Working fine, minor scratches on casing" value={form.condition_notes} onChange={set("condition_notes")}
              onFocus={addFocus} onBlur={remFocus} id="list-condition" />
          </div>

          {/* Description */}
          <div>
            <label style={S.label}>Description</label>
            <textarea style={S.textarea} placeholder="Pinout details, cables included, project history, etc." value={form.description} onChange={set("description")}
              onFocus={addFocus} onBlur={remFocus} id="list-description" rows={3} />
          </div>

          {/* Photo upload */}
          <div>
            <label style={S.label}>Photo (Optional)</label>
            <div style={{ border: "2px dashed rgba(0,255,163,0.35)", borderRadius: 14, padding: 16, textAlign: "center", background: "rgba(0,255,163,0.02)", cursor: "pointer", transition: "all 0.2s ease" }}
              onClick={() => document.getElementById("list-image-stitch").click()}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(0,229,255,0.5)"; e.currentTarget.style.background = "rgba(0,229,255,0.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(0,255,163,0.35)"; e.currentTarget.style.background = "rgba(0,255,163,0.02)"; }}>
              <input type="file" id="list-image-stitch" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
              {form.image_data ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <img src={form.image_data} alt="Preview" style={{ maxHeight: 120, borderRadius: 10, border: "1px solid rgba(195,192,255,0.4)" }} />
                  <button onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, image_data: null })); }}
                    style={{ padding: "4px 14px", borderRadius: 9999, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Remove Image
                  </button>
                </div>
              ) : (
                <>
                  <Camera size={24} color="#94a3b8" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 2 }}>Add Component Photo</p>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "#94a3b8" }}>Click to upload · Max 5MB</span>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#dc2626" }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button onClick={submit} disabled={!valid || loading} style={S.submitBtn(!valid || loading)} id="list-submit">
            {loading ? "Saving…" : editItem ? "Save Changes" : "Post Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}
