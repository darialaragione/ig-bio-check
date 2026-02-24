import { useMemo, useRef, useState } from "react";
import "./igbio.css";

const loadingSteps = [
  "Leggo bio e nome profilo…",
  "Valuto payoff e keyword…",
  "Controllo CTA e link…",
  "Analizzo coerenza della griglia…",
  "Creo bio alternative migliori…",
];

type Tab =
  | "Panoramica"
  | "Errori"
  | "Bio riscritte"
  | "Payoff & CTA"
  | "Feed check"
  | "Template";

function bandText(score: number) {
  if (score <= 39) return "Bio confusa: non comunica valore.";
  if (score <= 59) return "C’è potenziale, ma manca conversione.";
  if (score <= 79) return "Buona base: servono ottimizzazioni.";
  return "Bio forte: chiara, memorabile e vendibile.";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function copy(text: string) {
  navigator.clipboard?.writeText(text);
}

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [phase, setPhase] = useState<"upload" | "loading" | "result">("upload");
  const [stepIdx, setStepIdx] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<any | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const [data, setData] = useState<any | null>(null);
  const [tab, setTab] = useState<Tab>("Panoramica");

  const canAnalyze = !!file;
  const score = data?.scores?.total ?? 0;

  const subScores = useMemo(() => {
    if (!data?.scores) return [];
    const s = data.scores;
    return [
      ["Chiarezza identità", `${s.chiarezza_identita}/15`],
      ["Posizionamento", `${s.posizionamento}/10`],
      ["Promessa / beneficio", `${s.promessa_beneficio}/15`],
      ["Payoff", `${s.payoff}/15`],
      ["Autorità / prova di valore", `${s.autorita_prova_valore}/10`],
      ["Keyword SEO IG", `${s.keyword_seo_ig}/10`],
      ["CTA", `${s.cta}/15`],
      ["Link in bio", `${s.link_in_bio}/10`],
      ["Leggibilità", `${s.leggibilita_struttura}/10`],
    ];
  }, [data]);

  async function onPick(f: File | null) {
    setError(null);
    setDebug(null);
    setShowDebug(false);
    setData(null);
    setTab("Panoramica");
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function analyze() {
    if (!file) return;

    setError(null);
    setDebug(null);
    setShowDebug(false);

    setPhase("loading");
    setStepIdx(0);

    const start = Date.now();
    const tick = setInterval(() => {
      setStepIdx((i) => clamp(i + 1, 0, loadingSteps.length - 1));
    }, 1400);

    try {
      const fd = new FormData();
      fd.append("screenshot", file);

      const res = await fetch("/api/analyze", { method: "POST", body: fd });

      let payload: any = null;
      let rawText = "";
      const ct = res.headers.get("content-type") || "";

      // Provo a leggere la risposta in modo robusto
      if (ct.includes("application/json")) {
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
      } else {
        try {
          rawText = await res.text();
        } catch {
          rawText = "";
        }
      }

      // Se non OK, tiro errore con messaggio VERO
      if (!res.ok) {
        const msg =
          payload?.message ||
          payload?.error ||
          (rawText ? rawText.slice(0, 180) : "") ||
          `Errore server (${res.status}).`;

        setDebug({
          status: res.status,
          contentType: ct,
          payload,
          rawText: rawText ? rawText.slice(0, 800) : "",
        });

        throw new Error(msg);
      }

      // Se ok ma payload è null (caso raro), errore
      if (!payload) {
        setDebug({
          status: res.status,
          contentType: ct,
          payload,
          rawText: rawText ? rawText.slice(0, 800) : "",
        });
        throw new Error("Risposta non valida dal server (non JSON).");
      }

      // Tempo minimo “UX loading”
      const elapsed = Date.now() - start;
      const minMs = 6200;
      if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));

      setData(payload);
      setPhase("result");
    } catch (e: any) {
      const elapsed = Date.now() - start;
      const minMs = 4200;
      if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));

      setPhase("upload");

      const msg =
        e?.message ||
        "Errore sconosciuto. Riprova.";

      // Messaggio umano + verità
      setError(
        `⚠️ ${msg}\n\nSe ti sembra assurdo, apri “Dettagli tecnici” (è colpa del backend, non dello screenshot).`
      );
    } finally {
      clearInterval(tick);
    }
  }

  return (
    <div className="container">
      {phase === "upload" && (
        <>
          <h1 className="h1">La tua bio Instagram funziona davvero?</h1>
          <p className="sub">
            Carica uno screenshot del tuo profilo (bio + griglia foto) e ottieni
            punteggio, errori e bio riscritte.
          </p>

          <div className="card">
            <div
              className="drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onPick(f);
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  width: "100%",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btnGhost"
                  onClick={() => inputRef.current?.click()}
                >
                  Carica immagine
                </button>
                <div className="small">Oppure trascina qui lo screenshot</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="small" style={{ lineHeight: 1.45 }}>
                ✅ Lo screenshot deve includere: <b>bio + link + prime 9 foto</b>
                <br />
                📌 Meglio se includi anche gli highlight
                <br />
                🔒 Nessun login, niente API Meta
              </div>

              {preview && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img className="miniImg" src={preview} alt="preview" />
                  <div className="small">{file?.name}</div>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btnPrimary"
                  disabled={!canAnalyze}
                  onClick={analyze}
                >
                  Analizza profilo
                </button>
                <div className="small">Tempo stimato: 10 secondi</div>
              </div>

              <button
                className="btn btnGhost btnSmall"
                onClick={() => setShowModal(true)}
              >
                Non sai che screenshot caricare? Guarda un esempio
              </button>

              {error && (
                <div className="warnBox" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                  <b style={{ display: "block", marginBottom: 6 }}>
                    ⚠️ Attenzione
                  </b>
                  {error}

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="btn btnSmall btnGhost"
                      onClick={() => {
                        setError(null);
                        onPick(null);
                      }}
                    >
                      Carica un altro screenshot
                    </button>

                    {debug && (
                      <button
                        className="btn btnSmall btnGhost"
                        onClick={() => setShowDebug((v) => !v)}
                        style={{ borderColor: "rgba(0,212,255,.55)" }}
                      >
                        {showDebug ? "Nascondi dettagli tecnici" : "Dettagli tecnici"}
                      </button>
                    )}
                  </div>

                  {debug && showDebug && (
                    <div style={{ marginTop: 10 }}>
                      <div className="small" style={{ marginBottom: 6 }}>
                        Questo serve solo per capire l’errore vero.
                      </div>
                      <textarea
                        className="pre"
                        readOnly
                        value={JSON.stringify(debug, null, 2)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="small" style={{ marginTop: 18 }}>
                Non salviamo i tuoi dati (a meno che tu non lo chieda).
                <br />
                Questo tool analizza la comunicazione, non i dati ufficiali di
                Instagram.
              </div>
            </div>
          </div>

          {showModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 18,
                zIndex: 50,
              }}
              onClick={() => setShowModal(false)}
            >
              <div
                style={{
                  width: "min(720px,100%)",
                  background: "white",
                  borderRadius: 18,
                  padding: 18,
                  border: "1px solid var(--border)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ margin: "0 0 10px 0" }}>
                  Come fare lo screenshot giusto
                </h2>
                <div className="small" style={{ marginBottom: 10 }}>
                  Deve vedersi:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>foto profilo</li>
                  <li>nome + username</li>
                  <li>bio completa</li>
                  <li>link in bio</li>
                  <li>bottoni (contatta/shop)</li>
                  <li>
                    <b>prime 9 foto/reel della griglia</b>
                  </li>
                </ul>
                <div className="warnBox" style={{ marginTop: 12 }}>
                  ⚠️ <b>Se le foto non si vedono, l’analisi sarà incompleta.</b>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}
                >
                  <button className="btn btnPrimary" onClick={() => setShowModal(false)}>
                    Ok, carico lo screenshot
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {phase === "loading" && (
        <div className="card">
          <h1 className="h1" style={{ fontSize: 26 }}>
            Sto analizzando il tuo profilo…
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loadingSteps.map((t, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 99,
                      background: done ? "var(--magenta)" : "var(--ciano)",
                      opacity: active || done ? 1 : 0.35,
                    }}
                  />
                  <div style={{ opacity: active || done ? 1 : 0.45, fontWeight: active ? 900 : 700 }}>
                    {t}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="small" style={{ marginTop: 12 }}>
            Non è magia: è strategia + copy.
          </div>
        </div>
      )}

      {phase === "result" && data && (
        <>
          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {preview && <img className="miniImg" src={preview} alt="screenshot" />}
                <div>
                  <div className="small">Risultato analisi</div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {data.extracted?.username ?? "@username"}{" "}
                    <span className="small" style={{ fontWeight: 700 }}>
                      · {data.extracted?.profile_name ?? "Nome profilo"}
                    </span>
                  </div>
                  <div className="small">
                    Analisi basata su screenshot: risultati indicativi ma utili per ottimizzare.
                  </div>
                </div>
              </div>

              <div style={{ minWidth: 260 }}>
                <div style={{ fontSize: 34, fontWeight: 900 }}>
                  BIO SCORE: {score}/100
                </div>
                <div className="small">{bandText(score)}</div>
                <div className="bar" style={{ marginTop: 10 }}>
                  <div className="barFill" style={{ width: `${clamp(score, 0, 100)}%` }} />
                </div>
              </div>
            </div>

            <div className="hr" />

            <div className="tabs">
              {(
                ["Panoramica", "Errori", "Bio riscritte", "Payoff & CTA", "Feed check", "Template"] as Tab[]
              ).map((t) => (
                <button
                  key={t}
                  className={"tab " + (tab === t ? "tabActive" : "")}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 14 }} />

          {tab === "Panoramica" && (
            <div className="card">
              <h2 style={{ margin: "0 0 8px 0" }}>Panoramica veloce</h2>
              <div className="small" style={{ marginBottom: 10 }}>
                Punteggi per area
              </div>

              <div className="grid2">
                {subScores.map(([k, v]) => (
                  <div className="kv" key={k}>
                    <span>{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
              </div>

              <div className="hr" />

              <div className="grid2">
                <div className="card" style={{ background: "white" }}>
                  <div className="pill pillCyan" style={{ marginBottom: 10 }}>
                    Cosa funziona (bene)
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {(data.strengths ?? []).slice(0, 3).map((s: string) => (
                      <li key={s}>✅ {s}</li>
                    ))}
                  </ul>
                </div>

                <div className="warnBox">
                  <b>Cosa ti sta facendo perdere follower</b>
                  <ul style={{ margin: "10px 0 0 0", paddingLeft: 18 }}>
                    {(data.problems ?? []).slice(0, 3).map((p: any) => (
                      <li key={p.title}>⚠️ {p.title}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === "Errori" && (
            <div className="card">
              <h2 style={{ margin: "0 0 6px 0" }}>Errori principali</h2>
              <div className="small" style={{ marginBottom: 12 }}>
                Qui ci sono le cose che stanno sabotando la tua bio.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(data.problems ?? []).slice(0, 5).map((p: any) => (
                  <div className="warnBox" key={p.title}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <b>⚠️ Errore:</b> {p.title}
                      </div>
                      {p.urgent ? <span className="pill pillYellow">URGENTE</span> : null}
                    </div>
                    <div className="small" style={{ marginTop: 8 }}>
                      {p.explanation}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <b>🔧 Fix:</b> {p.fix}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hr" />
              <div className="small">
                Sistemandone anche solo 2, il profilo migliora subito.
              </div>
            </div>
          )}

          {tab === "Bio riscritte" && (
            <div className="card">
              <h2 style={{ margin: "0 0 6px 0" }}>Bio riscritte (pronte da copiare)</h2>
              <div className="small" style={{ marginBottom: 12 }}>
                Scegli quella più vicina al tuo stile e incollala subito su Instagram.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="card" style={{ background: "white" }}>
                  <b>Versione professionale</b>
                  <div className="small" style={{ margin: "6px 0 10px 0" }}>
                    Usala se vuoi sembrare più autorevole.
                  </div>
                  <textarea className="pre" readOnly value={data.rewrites?.professionale ?? ""} />
                  <button className="btn btnCopy" onClick={() => copy(data.rewrites?.professionale ?? "")}>
                    Copia bio
                  </button>
                </div>

                <div className="card" style={{ background: "white" }}>
                  <b>Versione creativa</b>
                  <div className="small" style={{ margin: "6px 0 10px 0" }}>
                    Perfetta se vuoi essere memorabile.
                  </div>
                  <textarea className="pre" readOnly value={data.rewrites?.creativa ?? ""} />
                  <button className="btn btnCopy" onClick={() => copy(data.rewrites?.creativa ?? "")}>
                    Copia bio
                  </button>
                </div>

                <div className="card" style={{ background: "white", borderColor: "rgba(255,212,0,.55)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <b>Versione conversione pura</b>
                    <span className="pill pillYellow">⭐ Consigliata</span>
                  </div>
                  <div className="small" style={{ margin: "6px 0 10px 0" }}>
                    Pensata per far cliccare il link o scriverti in DM.
                  </div>
                  <textarea className="pre" readOnly value={data.rewrites?.conversione_pura ?? ""} />
                  <button className="btn btnCopy" onClick={() => copy(data.rewrites?.conversione_pura ?? "")}>
                    Copia bio
                  </button>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="btn btnGhost" onClick={() => alert("MVP: rigenerazione non attiva in MOCK. Quando attacchi AI, rigenera qui.")}>
                    Rigenera altre bio
                  </button>
                  <span className="small">Vuoi più alternative? Te ne creo altre 3.</span>
                </div>
              </div>
            </div>
          )}

          {tab === "Payoff & CTA" && (
            <div className="card">
              <h2 style={{ margin: "0 0 6px 0" }}>Payoff e CTA che funzionano</h2>
              <div className="small" style={{ marginBottom: 12 }}>
                Qui trovi frasi pronte per rendere la bio più forte e più cliccabile.
              </div>

              <div className="grid2">
                <div className="card" style={{ background: "white" }}>
                  <b>Payoff suggeriti</b>
                  <div className="small" style={{ margin: "6px 0 10px 0" }}>
                    Scegline uno e usalo come “firma” del profilo.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(data.payoff_suggestions ?? []).slice(0, 5).map((p: string) => (
                      <div key={p} className="kv">
                        <span>{p}</span>
                        <button className="btn btnSmall btnCopy" onClick={() => copy(p)}>
                          Copia
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ background: "white" }}>
                  <b>CTA consigliate</b>
                  <div className="small" style={{ margin: "6px 0 10px 0" }}>
                    Devono essere brevi e con un verbo chiaro.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(data.cta_suggestions ?? []).slice(0, 3).map((c: string) => (
                      <div key={c} className="kv">
                        <span>{c}</span>
                        <button className="btn btnSmall btnCopy" onClick={() => copy(c)}>
                          Copia
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "Feed check" && (
            <div className="card">
              <h2 style={{ margin: "0 0 6px 0" }}>Feed check (prime 9 foto)</h2>
              <div className="small" style={{ marginBottom: 12 }}>
                La bio può essere perfetta, ma se la griglia è confusa… perdi subito persone.
              </div>

              <div className="grid2">
                <div className="kv">
                  <span>Coerenza visiva</span>
                  <b>{data.scores?.feed_check?.coerenza_visiva ?? 0}/10</b>
                </div>
                <div className="kv">
                  <span>Coerenza contenuti</span>
                  <b>{data.scores?.feed_check?.coerenza_contenuti ?? 0}/10</b>
                </div>
                <div className="kv">
                  <span>Riconoscibilità format</span>
                  <b>{data.scores?.feed_check?.riconoscibilita_format ?? 0}/10</b>
                </div>
              </div>

              <div className="hr" />

              <div className="warnBox">
                <b>Problemi del feed</b>
                <ul style={{ margin: "10px 0 0 0", paddingLeft: 18 }}>
                  <li>⚠️ Troppi argomenti diversi nelle prime 9.</li>
                  <li>⚠️ Nessun format ripetuto: non sei riconoscibile.</li>
                </ul>
              </div>

              <div style={{ marginTop: 12 }}>
                <b>Fix immediati</b>
                <ul style={{ margin: "10px 0 0 0", paddingLeft: 18 }}>
                  <li>🔧 Scegli 2 format ricorrenti (es. “ricetta 15 min” + “spesa furba”).</li>
                  <li>🔧 Metti cover coerenti per i reel.</li>
                  <li>🔧 Ripeti stile e parole chiave nei titoli.</li>
                </ul>
              </div>

              <div className="small" style={{ marginTop: 12 }}>
                Obiettivo: far capire cosa fai in 3 secondi anche senza leggere la bio.
              </div>
            </div>
          )}

          {tab === "Template" && (
            <div className="card">
              <h2 style={{ margin: "0 0 6px 0" }}>Template bio (struttura consigliata)</h2>
              <div className="small" style={{ marginBottom: 12 }}>
                Se vuoi scriverla da zero, usa questo schema.
              </div>

              <div className="card" style={{ background: "white" }}>
                {(data.template ?? []).map((t: string) => (
                  <div key={t} style={{ fontWeight: 900, marginBottom: 6 }}>
                    {t}
                  </div>
                ))}
              </div>

              <div className="hr" />

              <div className="card" style={{ background: "white", borderColor: "rgba(255,43,191,.35)" }}>
                <b>Bio finale consigliata</b>
                <div className="small" style={{ margin: "6px 0 10px 0" }}>
                  È la versione più completa e più coerente col tuo profilo.
                </div>
                <textarea className="pre" readOnly value={data.final_bio ?? ""} />
                <button className="btn btnCopy" onClick={() => copy(data.final_bio ?? "")}>
                  Copia bio definitiva
                </button>
              </div>
            </div>
          )}

          <div style={{ height: 14 }} />

          <div className="card">
            <h2 style={{ margin: "0 0 10px 0" }}>🔥 Prima / Dopo: cosa cambia</h2>

            <div className="grid2">
              <div className="card" style={{ background: "white" }}>
                <b>Cosa abbiamo tolto</b>
                <ul style={{ margin: "10px 0 0 0", paddingLeft: 18 }}>
                  {(data.before_after?.removed ?? []).map((x: string) => (
                    <li key={x}>- {x}</li>
                  ))}
                </ul>
              </div>

              <div className="card" style={{ background: "white" }}>
                <b>Cosa abbiamo aggiunto</b>
                <ul style={{ margin: "10px 0 0 0", paddingLeft: 18 }}>
                  {(data.before_after?.added ?? []).map((x: string) => (
                    <li key={x}>+ {x}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card" style={{ background: "white", marginTop: 12 }}>
              <b>Perché adesso funziona meglio</b>
              <ul style={{ margin: "10px 0 0 0", paddingLeft: 18 }}>
                {(data.before_after?.why_it_works ?? []).map((x: string) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            </div>

            <div className="hr" />
            <button
              className="btn btnGhost"
              onClick={() => {
                setPhase("upload");
                setData(null);
                setError(null);
                setDebug(null);
                setShowDebug(false);
              }}
            >
              Analizza un altro screenshot
            </button>
          </div>
        </>
      )}
    </div>
  );
}
