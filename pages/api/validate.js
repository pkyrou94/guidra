export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = req.body;
  const required = ["oneLiner", "targetUser", "pain", "alternatives", "pricing", "founderFit"];
  const missing = required.filter((key) => !data[key] || data[key].trim() === "");

  // 1️⃣ Δημιουργούμε note αν λείπουν πεδία
  const note =
    missing.length > 0
      ? `⚠️ Some key fields are missing (${missing.join(", ")}). The overall score may be less accurate.`
      : null;

  try {
    // 2️⃣ Καλύτερο prompt — ρεαλιστικό, “consulting style”
    const prompt = `
You are an expert startup evaluator and investor. Assess this business idea and respond in structured JSON.

Idea details:
- One-liner: ${data.oneLiner || "N/A"}
- Target user: ${data.targetUser || "N/A"}
- Problem: ${data.pain || "N/A"}
- Alternatives: ${data.alternatives || "N/A"}
- Pricing: ${data.pricing || "N/A"}
- Founder fit: ${data.founderFit || "N/A"}

Evaluate based on the following 4 dimensions (0-25 each):
1. Problem clarity & urgency
2. Target market definition
3. Uniqueness vs alternatives
4. Monetization viability

Return a JSON like this:
{
  "scores": {
    "problem_clarity": number,
    "target_market": number,
    "uniqueness": number,
    "monetization": number
  },
  "total": number,
  "verdict": "Excellent" | "Good" | "Fair" | "Weak",
  "top_risks": [string],
  "next_steps": [string],
  "positioning": string
}

Then give realistic, short, practical next steps.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || "OpenAI API request failed.");
    }

    let parsed;
    try {
    // Παίρνουμε το περιεχόμενο που έστειλε το AI
    let content = result.choices[0].message.content.trim();

    // Καθαρίζουμε πιθανό markdown (```json ... ```)
    content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

    parsed = JSON.parse(content);
    } catch (err) {
      console.error("Parsing error:", err, result.choices?.[0]?.message?.content);
      throw new Error("Failed to parse AI response.");
    }

    // 3️⃣ Επιστρέφουμε καθαρό report + note
    res.status(200).json({ ...parsed, note });
  } catch (err) {
    console.error("Validation error:", err);
    res.status(500).json({
      error: "⚠️ Server error during evaluation. Please try again later.",
      details: err.message,
    });
  }
}
