import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import OpenAI from "openai";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max
});

const ONE_SHOT_PROMPT = `
Sei un Social Media Manager esperto di creator economy e conversion copywriting per Instagram.
Analizza UNO screenshot del profilo (bio + link + prime 9 foto).

REGOLE:
- Non inventare dati mancanti.
- Mantieni emoji e a capo.
- Se non leggibile: [ILLEGIBILE]
- Se non presente: [NON PRESENTE NELLO SCREENSHOT]
- Tono: diretto e pratico.
- Restituisci SOLO JSON valido (niente testo extra).

SCHEMA JSON ESATTO:
{
  "extracted": {
    "profile_name": "...",
    "username": "...",
    "category": "...",
    "bio": "...",
    "link_in_bio": "...",
    "cta_buttons": ["..."],
    "highlights": ["..."],
    "counts": {"posts": "...", "followers": "...", "following": "..."}
  },
  "ocr_reliability": {"level": "ALTA|MEDIA|BASSA", "reason": "..."},
  "scores": {
    "total": 0,
    "chiarezza_identita": 0,
    "posizionamento": 0,
    "promessa_beneficio": 0,
    "payoff": 0,
    "autorita_prova_valore": 0,
    "keyword_seo_ig": 0,
    "cta": 0,
    "link_in_bio": 0,
    "leggibilita_struttura": 0,
    "feed_check": {
      "coerenza_visiva": 0,
      "coerenza_contenuti": 0,
      "riconoscibilita_format": 0,
      "limitations": ""
    }
  },
  "summary": {
    "headline": "BIO SCORE: XX/100",
    "band_text": "",
    "one_liner": "",
    "diagnosis_3_lines": ""
  },
  "strengths": ["..."],
  "problems": [{"title":"...", "explanation":"...", "fix":"...", "urgent": true}],
  "quick_fixes": ["..."],
  "rewrites": {
    "professionale": "...",
    "creativa": "...",
    "conversione_pura": "..."
  },
  "payoff_suggestions": ["..."],
  "cta_suggestions": ["..."],
  "template": ["[Chi sei]","[Per chi / cosa fai]","[Risultato / promessa]","[Payoff]","[CTA + link]"],
  "final_bio": "...",
  "before_after": {
    "removed": ["..."],
    "added": ["..."],
    "why_it_works": ["..."]
  },
  "limitations": ["..."]
}
`;

// MOCK stabile
const sample = {
  extracted: {
    profile_name: "Cucino & ti salvo la cena",
    username: "@cenasalvata",
    category: "Creator",
    bio: "🍝 Ricette veloci (davvero)\n⏱️ 15 min e vai a tavola\n📍 Napoli\n✨ La cena non si improvvisa: si salva.\n⬇️ Scarica la lista spesa",
    link_in_bio: "linktr.ee/cenasalvata",
    cta_buttons: ["Email", "Contatta"],
    highlights: ["Ricette", "Spesa", "FAQ", "Collab"],
    counts: { posts: "312", followers: "28.4k", following: "511" },
  },
  ocr_reliability: {
    level: "ALTA",
    reason: "Testo leggibile e ben contrastato nello screenshot.",
  },
  scores: {
    total: 72,
    chiarezza_identita: 13,
    posizionamento: 7,
    promessa_beneficio: 12,
    payoff: 9,
    autorita_prova_valore: 6,
    keyword_seo_ig: 8,
    cta: 10,
    link_in_bio: 4,
    leggibilita_struttura: 3,
    feed_check: {
      coerenza_visiva: 6,
      coerenza_contenuti: 7,
      riconoscibilita_format: 5,
      limitations: "",
    },
  },
  summary: {
    headline: "BIO SCORE: 72/100",
    band_text: "Buona base: servono ottimizzazioni.",
    one_liner:
      "Punti forti: chiarezza e promessa. Da migliorare: payoff, struttura e link.",
    diagnosis_3_lines:
      "Profilo chiaro e utile, ma poco memorabile.\nPayoff ok ma non distintivo: sembra di molti.\nCTA buona, link dispersivo: stai perdendo click.",
  },
  strengths: [
    "Chiaro cosa pubblichi (ricette veloci).",
    "Promessa concreta (15 minuti).",
    "Geolocalizzazione utile (Napoli).",
  ],
  problems: [
    {
      title: "Link dispersivo",
      explanation: "Troppe scelte = meno click e meno conversioni.",
      fix: "Porta a UNA pagina con una sola azione.",
      urgent: true,
    },
    {
      title: "Payoff poco distintivo",
      explanation: "È carino, ma potrebbe essere di qualunque creator.",
      fix: "Rendi il payoff più ‘tuo’.",
      urgent: false,
    },
    {
      title: "Formattazione compressa",
      explanation: "Non scansiona bene in 3 secondi.",
      fix: "Una riga per idea.",
      urgent: false,
    },
  ],
  quick_fixes: [
    "Metti keyword nel nome profilo.",
    "Promessa in prima riga.",
    "Link singolo.",
    "CTA con trigger DM.",
    "Payoff più distintivo.",
  ],
  rewrites: {
    professionale:
      "🍝 Ricette 15 min per chi lavora\n🧾 Liste spesa + menu settimanali\n📍 Napoli | Video pratici, zero fuffa\n✨ La cena non si improvvisa: si salva.\n⬇️ Scarica la lista spesa",
    creativa:
      "🍝 Ti salvo la cena, ogni giorno\n⏱️ Ricette 15 min (senza drama)\n📍 Napoli | spesa furba & trucchi\n✨ La padella capisce più di te.\n⬇️ Prendi la lista spesa",
    conversione_pura:
      "🍝 Ricette 15 min per non ordinare delivery\n✅ Menu + liste spesa pronti\n📍 Napoli | 1 video = 1 soluzione\n✨ Cena salvata, umore pure.\n💌 DM “LISTA” e te la mando",
  },
  payoff_suggestions: [
    "Cena salvata, vita più facile",
    "Ricette 15 min, zero stress",
    "Meno delivery, più gusto",
    "Spesa furba, cucina felice",
    "Ti salvo la cena ogni giorno",
  ],
  cta_suggestions: [
    "💌 Scrivimi “LISTA” in DM",
    "⬇️ Scarica la lista spesa",
    "📌 Guarda i menu in evidenza",
  ],
  template: [
    "[Chi sei]",
    "[Per chi / cosa fai]",
    "[Risultato / promessa]",
    "[Payoff]",
    "[CTA + link]",
  ],
  final_bio:
    "🍝 Ricette 15 min per chi lavora\n🧾 Liste spesa + menu settimanali\n📍 Napoli | pratico, senza fuffa\n✨ Cena salvata, vita più facile\n💌 DM “LISTA” e te la mando",
  before_after: {
    removed: [
      "Link con troppe scelte",
      "Frasi generiche",
      "Struttura compressa",
    ],
    added: ["Keyword", "Promessa in alto", "CTA DM", "Payoff distintivo"],
    why_it_works: [
      "Si capisce subito cosa fai",
      "Una sola azione",
      "Più memorabile",
    ],
  },
  limitations: [],
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.post("/api/analyze", upload.single("screenshot"), async (req, res) => {
    const useMock = String(process.env.USE_MOCK || "").toLowerCase() === "true";

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "missing_screenshot",
          message:
            "Carica uno screenshot che includa bio + link + prime 9 foto.",
        });
      }

      // ✅ MOCK
      if (useMock) return res.json(sample);

      // ✅ KEY CHECK
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          error: "missing_openai_key",
          message:
            "OPENAI_API_KEY non trovata. Mettila in server/.env e riavvia (Stop/Run).",
        });
      }

      // ✅ OpenAI call (con errori VERI)
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const base64 = req.file.buffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

      let resp: any;
      try {
        resp = await client.responses.create({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: ONE_SHOT_PROMPT },
                { type: "input_image", image_url: dataUrl },
              ],
            },
          ],
        });
      } catch (e: any) {
        return res.status(502).json({
          error: "openai_error",
          message: e?.message || "OpenAI error",
          status: e?.status,
          code: e?.code,
          type: e?.type,
        });
      }

      const text = String(resp?.output_text || "").trim();

      // ✅ JSON parse robusto + ritorno errori chiari
      try {
        return res.json(JSON.parse(text));
      } catch {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
          try {
            return res.json(JSON.parse(text.slice(start, end + 1)));
          } catch {
            return res.status(500).json({
              error: "bad_json",
              message: "Il modello non ha restituito JSON valido.",
              raw: text.slice(0, 900),
            });
          }
        }

        return res.status(500).json({
          error: "bad_output",
          message: "Il modello ha restituito output non JSON.",
          raw: text.slice(0, 900),
        });
      }
    } catch (e: any) {
      return res.status(500).json({
        error: "analyze_failed",
        message: e?.message || "Unknown error",
      });
    }
  });

  return httpServer;
}
