import { useState } from "react";

export default function Home() {
  const [form, setForm] = useState({
    oneLiner: "", 
    targetUser: "", 
    pain: "", 
    alternatives: "",
    channels: "", 
    pricing: "", 
    founderFit: "", 
    consent: false
  });
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [missingFields, setMissingFields] = useState([]);
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    //Validation check for required fields
    const required = ["oneLiner", "targetUser", "pain", "alternatives"];
    const missing = required.filter((f) => !form[f].trim());

    // Highlight missing fields visually
    setMissingFields(missing);

    if (missing.length > 0) {
      const formatted = missing.map((f) => {
        if (f === "oneLiner") return "One-liner";
        if (f === "targetUser") return "Target user";
        if (f === "pain") return "Problem";
        if (f === "alternatives") return "Alternatives";
        return f;
      });

      setError(`For a more accurate score, please fill in the required fields: ${formatted.join(", ")}.`);
      return;
    }

    if (emptyOptionals.length > 0) {
      setError("Note: Some optional fields are missing, so your score might not be 100% accurate.");
    }

    setLoading(true); setError(""); setReport(null);
    try {
      const r = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Spinner animation keyframes
  if (typeof document !== "undefined" && !document.getElementById("spinner-style")) {
    const style = document.createElement("style");
    style.id = "spinner-style";
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  return (
    <div style={{fontFamily:"system-ui, -apple-system, Segoe UI, Roboto", padding:"24px", maxWidth:900, margin:"0 auto"}}>
      <h1 style={{marginBottom:4}}>Guidra</h1>
      <p style={{marginTop:0, color:"#555"}}>Validate your idea. Build with AI guidance.</p>

      <form onSubmit={submit} style={{display:"grid", gap:12, marginTop:16}}>
        <Input label="One-liner *" name="oneLiner" value={form.oneLiner} onChange={onChange} missingFields={missingFields} placeholder="e.g., AI tool that plans weekly meals for diabetics"/>
        <Input label="Target user *" name="targetUser" value={form.targetUser} onChange={onChange} missingFields={missingFields} placeholder="Who is it for?"/>
        <TextArea label="Problem (pain & frequency) *" name="pain" value={form.pain} onChange={onChange} missingFields={missingFields}/>
        <TextArea label="Current alternatives / competitors *" name="alternatives" value={form.alternatives} onChange={onChange} missingFields={missingFields}/>
        <Input label="Willingness-to-pay / pricing guess (Optional)" name="pricing" value={form.pricing} onChange={onChange} placeholder="$/month"/>
        <TextArea label="Founder fit (background/edge) (Optional)" name="founderFit" value={form.founderFit} onChange={onChange}/>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
          <input
            type="checkbox"
            name="consent"
            checked={form.consent}
            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          />
          <span>I agree to save my submission and receive product updates.</span>
        </label>

        <button 
          type="submit" 
          disabled={loading}
          style={{
            backgroundColor: loading ? "#94a3b8" : "#2563eb", // μπλε όταν έτοιμο, γκρι μόνο όταν loading
            color: "white",
            fontWeight: "bold",
            padding: "12px 24px",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.3s ease",
          }}
          onMouseEnter={(e) => {
            if (!loading) e.target.style.backgroundColor = "#1e40af"; // πιο σκούρο μπλε στο hover
          }}
          onMouseLeave={(e) => {
            if (!loading) e.target.style.backgroundColor = "#2563eb"; // επανέρχεται στο αρχικό μπλε
          }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span 
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid white",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}
              ></span>
              Analyzing...
            </span>
          ) : (
            "Get my score"
          )}
        </button>
      </form>

      {error && <p style={{color:"#c00"}}>{error}</p>}

      {report && (
        <div style={{marginTop:24, padding:16, border:"1px solid #eee", borderRadius:8}}>
          <h3 style={{marginTop:0}}>Your Report</h3>
          <p><strong>Total:</strong> {report.total}/100 — <strong>{report.verdict}</strong></p>
          <table style={{borderCollapse:"collapse"}}>
            <tbody>
              {Object.entries(report.scores || {}).map(([k,v])=>(
                <tr key={k}>
                  <td style={{padding:"4px 8px", borderBottom:"1px solid #f0f0f0"}}>{k}</td>
                  <td style={{padding:"4px 8px", borderBottom:"1px solid #f0f0f0"}}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Section title="Top risks" items={report.top_risks}/>
          <Section title="Next steps" items={report.next_steps}/>
          <Section title="Suggested channels" items={report.channels}/>
          <p><strong>Positioning:</strong> {report.positioning}</p>
        </div>
      )}
    </div>
  );
}

function Input({ label, name, value, onChange, missingFields = [], ...props }) {
  const isMissing = missingFields.includes(name);
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 14, color: "#333" }}>{label}</span>
      <input
        {...props}
        name={name}
        value={value}
        onChange={onChange}
        style={{
          padding: "10px 12px",
          border: `1px solid ${isMissing ? "#e11d48" : "#ddd"}`,
          borderRadius: 6,
          outline: "none"
        }}
      />
    </label>
  );
}

function TextArea({ label, name, value, onChange, missingFields = [], ...props }) {
  const isMissing = missingFields.includes(name);
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 14, color: "#333" }}>{label}</span>
      <textarea
        {...props}
        name={name}
        value={value}
        onChange={onChange}
        rows={3}
        style={{
          padding: "10px 12px",
          border: `1px solid ${isMissing ? "#e11d48" : "#ddd"}`,
          borderRadius: 6,
          outline: "none"
        }}
      />
    </label>
  );
}


function Section({title, items=[]}) {
  return (
    <div style={{marginTop:12}}>
      <h4 style={{margin:"12px 0 6px"}}>{title}</h4>
      <ul style={{margin:0, paddingLeft:18}}>
        {(items||[]).map((x,i)=><li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}
