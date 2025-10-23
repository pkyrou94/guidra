const fs = require("fs");
const path = require("path");

function toCsvRow(values) {
  // Escape διπλά quotes, τύλιγμα σε quotes για ασφάλεια
  const esc = (v) => `"${String(v??"").replace(/"/g, '""')}"`;
  return values.map(esc).join(",") + "\n";
}

async function appendCsv(filePath, headers, rowValues) {
  const exists = fs.existsSync(filePath);
  if (!exists) {
    fs.writeFileSync(filePath, headers.join(",") + "\n", "utf8");
  }
  fs.appendFileSync(filePath, toCsvRow(rowValues), "utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    oneLiner = "",
    targetUser = "",
    pain = "",
    alternatives = "",
    channels = "",
    pricing = "",
    founderFit = "",
    consent = false
  } = req.body || {};

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

  const system = `
You are a startup validation assistant. 
Score the idea on these dimensions with integers only:
- market (0-20)
- severity (0-20)
- gap (0-15)
- distribution (0-15)
- monetization (0-15)
- fit (0-15)
Return strict JSON:
{
  "scores": { "market": n, "severity": n, "gap": n, "distribution": n, "monetization": n, "fit": n },
  "total": n,
  "verdict": "Launch-ready|Iterate|Pivot",
  "top_risks": ["...", "...", "..."],
  "next_steps": ["...", "...", "...", "...", "..."],
  "channels": ["...", "...", "..."],
  "positioning": "one-sentence"
}
Banding: 80-100 Launch-ready; 60-79 Iterate; <60 Pivot.
Be specific and concise.`;

  const user = `
ONE-LINER: ${oneLiner}
TARGET USER: ${targetUser}
PAIN: ${pain}
ALTERNATIVES: ${alternatives}
CHANNELS: ${channels}
PRICING: ${pricing}
FOUNDER FIT: ${founderFit}
`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    const data = await r.json();

// Υποστήριξη και για πιθανές άλλες μορφές response
let content = data?.choices?.[0]?.message?.content 
            || data?.choices?.[0]?.delta?.content 
            || data?.error?.message 
            || JSON.stringify(data, null, 2);


// Try to recover JSON even if OpenAI adds extra text
let parsed;
try {
  parsed = JSON.parse(content);
} catch (e) {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : null;
  } catch {
    parsed = null;
  }
}

// If still nothing, return the raw model output for debugging
if (!parsed) {
  console.error("Raw model response:", content);
  return res.status(500).json({ error: "Bad model response", raw: content });
}


    const s = parsed.scores || {};
    const total = (s.market|0)+(s.severity|0)+(s.gap|0)+(s.distribution|0)+(s.monetization|0)+(s.fit|0);
    parsed.total = total;

    if (consent) {
      try {
        const csvPath = path.join(process.cwd(), "submissions.csv");
        const headers = [
          "timestamp","oneLiner","targetUser","pain","alternatives",
          "channels","pricing","founderFit","consent",
          "total","verdict","scores_market","scores_severity","scores_gap",
          "scores_distribution","scores_monetization","scores_fit",
          "top_risks","next_steps","channels_suggested","positioning"
        ];

        const s = parsed.scores || {};
        const row = [
          new Date().toISOString(),
          oneLiner, targetUser, pain, alternatives,
          channels, pricing, founderFit, consent ? "yes" : "no",
          parsed.total, parsed.verdict, s.market, s.severity, s.gap,
          s.distribution, s.monetization, s.fit,
          (parsed.top_risks||[]).join(" | "),
          (parsed.next_steps||[]).join(" | "),
          (parsed.channels||[]).join(" | "),
          parsed.positioning || ""
        ];

        await appendCsv(csvPath, headers, row);
      } catch (e) {
        console.error("CSV write error:", e);
      }
    } else {
      console.log("Consent not given — skipping CSV save");
    }

    return res.status(200).json(parsed);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
