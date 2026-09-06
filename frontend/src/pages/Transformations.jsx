import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api";
import SaveBar from "../components/SaveBar.jsx";
import { fileToDownscaledDataUrl } from "../components/imageFile.js";

const thumb = { width: "100%", height: 120, objectFit: "cover", borderRadius: 6, marginTop: 6 };

function LandingContent() {
  const [me, setMe] = useState(null);
  const [bio, setBio] = useState("");
  const [creds, setCreds] = useState("");
  const [photo, setPhoto] = useState(null); // staged
  const saved = useRef({ bio: "", creds: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then((u) => {
      setMe(u);
      setBio(u.bio || "");
      setCreds(u.credentials || "");
      saved.current = { bio: u.bio || "", creds: u.credentials || "" };
    });
  }, []);

  if (!me) return null;
  const dirty = bio !== saved.current.bio || creds !== saved.current.creds || photo !== null;

  async function stagePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      setPhoto(await fileToDownscaledDataUrl(file, 512, 0.85));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError("");
    const body = {};
    if (bio !== saved.current.bio) body.bio = bio;
    if (creds !== saved.current.creds) body.credentials = creds;
    if (photo !== null) body.profile_photo_url = photo;
    try {
      const u = await api.updateMe(body);
      setMe(u);
      saved.current = { bio: u.bio || "", creds: u.credentials || "" };
      setPhoto(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Your landing-page profile</h2>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="avatar" style={{ width: 56, height: 56, fontSize: "1.3rem" }}>
          {(photo || me.profile_photo_url)
            ? <img src={photo || me.profile_photo_url} alt="" />
            : (me.name || "?").slice(0, 1)}
        </span>
        <input type="file" accept="image/*" onChange={stagePhoto} disabled={busy} />
        {photo && <span className="muted">Staged — press save.</span>}
      </div>
      <label>Credentials</label>
      <input value={creds} onChange={(e) => setCreds(e.target.value)} placeholder="e.g. NASM-CPT, 10 years" />
      <label>Bio</label>
      <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      <SaveBar dirty={dirty} onSave={save} label="Save profile" error={error} />
    </div>
  );
}

const STAT_FIELDS = [
  ["total_clients_stat", "Clients"],
  ["total_transformations_stat", "Transformations"],
  ["total_sessions_stat", "Sessions completed"],
];
const statForm = (u) =>
  Object.fromEntries(STAT_FIELDS.map(([k]) => [k, u[k] ?? ""]));

// Manually-typed landing-page numbers. Independent of the real client /
// transformation / session data — the trainer just types whatever they want.
function LandingStats() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(statForm({}));
  const saved = useRef("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.me().then((u) => {
      setMe(u);
      const f = statForm(u);
      setForm(f);
      saved.current = JSON.stringify(f);
    });
  }, []);

  if (!me) return null;
  const dirty = JSON.stringify(form) !== saved.current;

  async function save() {
    setError("");
    const body = Object.fromEntries(
      STAT_FIELDS.map(([k]) => [
        k,
        form[k] === "" ? null : Math.max(0, Math.floor(Number(form[k]))),
      ]),
    );
    try {
      const u = await api.updateMe(body);
      setMe(u);
      const f = statForm(u);
      setForm(f);
      saved.current = JSON.stringify(f);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Landing page stats</h2>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        The headline numbers on the public landing page. You type these in — they are
        not counted from your clients, transformations, or sessions.
      </p>
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        {STAT_FIELDS.map(([key, label]) => (
          <div key={key} style={{ flex: 1, minWidth: 120 }}>
            <label>{label}</label>
            <input
              type="number"
              min="0"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <SaveBar dirty={dirty} onSave={save} label="Save stats" error={error} />
    </div>
  );
}

/* ============================================================
   Trainer-edited landing-page content (users.landing_content JSON blob).
   One shared copy in context; each subsection has its own SaveBar and does a
   read-modify-write of the whole blob via PATCH /users/me. No autosave.
   ============================================================ */
const LC = createContext(null);

function LandingContentProvider({ children }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .me()
      .then((u) => setContent(u.landing_content || {}))
      .catch((e) => setError(e.message));
  }, []);

  async function saveSection(patch) {
    const next = { ...(content || {}), ...patch };
    const u = await api.updateMe({ landing_content: next });
    setContent(u.landing_content || {});
  }

  if (error) return <div className="card error">{error}</div>;
  if (content === null) return null;
  return <LC.Provider value={{ content, saveSection }}>{children}</LC.Provider>;
}

function useSection(build) {
  const { content, saveSection } = useContext(LC);
  const [state, setState] = useState(() => build(content));
  const saved = useRef(JSON.stringify(build(content)));
  const [error, setError] = useState("");
  const dirty = JSON.stringify(state) !== saved.current;

  async function onSave(toPayload) {
    setError("");
    try {
      await saveSection(toPayload(state));
      saved.current = JSON.stringify(state);
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }
  return { state, setState, dirty, error, onSave };
}

function HeroEditor() {
  const { state, setState, dirty, error, onSave } = useSection((c) => ({
    hero_headline: c.hero_headline || "",
    hero_subheadline: c.hero_subheadline || "",
  }));
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Landing hero</h2>
      <label>Headline</label>
      <input
        value={state.hero_headline}
        maxLength={140}
        placeholder="Defaults to your name"
        onChange={(e) => setState({ ...state, hero_headline: e.target.value })}
      />
      <label>Sub-headline</label>
      <textarea
        rows={2}
        value={state.hero_subheadline}
        maxLength={280}
        placeholder="Defaults to your bio"
        onChange={(e) => setState({ ...state, hero_subheadline: e.target.value })}
      />
      <SaveBar dirty={dirty} onSave={() => onSave((s) => s)} label="Save hero" error={error} />
    </div>
  );
}

function WhyChooseUsEditor() {
  const { state, setState, dirty, error, onSave } = useSection((c) => {
    const arr = (c.why_choose_us || []).slice(0, 3).map((x) => ({
      title: x.title || "",
      description: x.description || "",
    }));
    while (arr.length < 3) arr.push({ title: "", description: "" });
    return arr;
  });
  const set = (i, k, v) => setState(state.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Why choose us</h2>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Three points. Leave one blank to hide it on the landing page.
      </p>
      <div className="lc-list">
        {state.map((r, i) => (
          <div key={i} className="lc-item">
            <label>Point {i + 1} — title</label>
            <input value={r.title} maxLength={80} onChange={(e) => set(i, "title", e.target.value)} />
            <label>One-line description</label>
            <input
              value={r.description}
              maxLength={240}
              onChange={(e) => set(i, "description", e.target.value)}
            />
          </div>
        ))}
      </div>
      <SaveBar
        dirty={dirty}
        onSave={() =>
          onSave((s) => ({
            why_choose_us: s.filter((r) => r.title.trim() || r.description.trim()),
          }))
        }
        label="Save why choose us"
        error={error}
      />
    </div>
  );
}

function TestimonialsEditor() {
  const { state, setState, dirty, error, onSave } = useSection((c) =>
    (c.testimonials || []).map((x) => ({
      name: x.name || "",
      quote: x.quote || "",
      rating: x.rating || 5,
    }))
  );
  const set = (i, k, v) => setState(state.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Testimonials</h2>
      <div className="lc-list">
        {state.map((r, i) => (
          <div key={i} className="lc-item">
            <div className="row">
              <label style={{ margin: 0 }}>Testimonial {i + 1}</label>
              <button
                type="button"
                className="mini"
                onClick={() => setState(state.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
            <label>Client name</label>
            <input value={r.name} maxLength={80} onChange={(e) => set(i, "name", e.target.value)} />
            <label>Quote</label>
            <textarea
              rows={2}
              value={r.quote}
              maxLength={800}
              onChange={(e) => set(i, "quote", e.target.value)}
            />
            <label>Rating</label>
            <select value={r.rating} onChange={(e) => set(i, "rating", Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
        {state.length === 0 && <p className="muted">No testimonials yet.</p>}
      </div>
      <button type="button" onClick={() => setState([...state, { name: "", quote: "", rating: 5 }])}>
        Add testimonial
      </button>
      <SaveBar
        dirty={dirty}
        onSave={() => onSave((s) => ({ testimonials: s.filter((r) => r.quote.trim()) }))}
        label="Save testimonials"
        error={error}
      />
    </div>
  );
}

function FaqEditor() {
  const { state, setState, dirty, error, onSave } = useSection((c) =>
    (c.faq || []).map((x) => ({ question: x.question || "", answer: x.answer || "" }))
  );
  const set = (i, k, v) => setState(state.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>FAQ</h2>
      <div className="lc-list">
        {state.map((r, i) => (
          <div key={i} className="lc-item">
            <div className="row">
              <label style={{ margin: 0 }}>Question {i + 1}</label>
              <button
                type="button"
                className="mini"
                onClick={() => setState(state.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
            <input
              value={r.question}
              maxLength={240}
              placeholder="Question"
              onChange={(e) => set(i, "question", e.target.value)}
            />
            <label>Answer</label>
            <textarea
              rows={2}
              value={r.answer}
              maxLength={1200}
              onChange={(e) => set(i, "answer", e.target.value)}
            />
          </div>
        ))}
        {state.length === 0 && <p className="muted">No FAQ entries yet.</p>}
      </div>
      <button type="button" onClick={() => setState([...state, { question: "", answer: "" }])}>
        Add question
      </button>
      <SaveBar
        dirty={dirty}
        onSave={() => onSave((s) => ({ faq: s.filter((r) => r.question.trim()) }))}
        label="Save FAQ"
        error={error}
      />
    </div>
  );
}

function ContactEditor() {
  const { state, setState, dirty, error, onSave } = useSection((c) => ({
    contact_phone: c.contact_phone || "",
    instagram: c.instagram || "",
  }));
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Contact</h2>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Shown in the landing page's "Get in touch" section. The phone number is a
        click-to-call link on mobile. This is separate from your login phone number.
      </p>
      <label>Phone number</label>
      <input
        value={state.contact_phone}
        maxLength={40}
        placeholder="+91 98765 43210"
        onChange={(e) => setState({ ...state, contact_phone: e.target.value })}
      />
      <label>Instagram (handle or full link)</label>
      <input
        value={state.instagram}
        maxLength={120}
        placeholder="@yourhandle"
        onChange={(e) => setState({ ...state, instagram: e.target.value })}
      />
      <SaveBar dirty={dirty} onSave={() => onSave((s) => s)} label="Save contact" error={error} />
    </div>
  );
}

const BLANK = { client_name: "", caption: "", before_photo_url: "", after_photo_url: "" };

function TransformationRow({ item, count, onChange }) {
  const [row, setRow] = useState(item);
  const saved = useRef(JSON.stringify(item));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canDelete = count > 2;

  const dirty = JSON.stringify(row) !== saved.current;

  async function pick(e, key) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDownscaledDataUrl(file, 900, 0.82);
      setRow((r) => ({ ...r, [key]: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError("");
    try {
      await api.updateTransformation(item.id, {
        client_name: row.client_name,
        caption: row.caption || null,
        before_photo_url: row.before_photo_url || null,
        after_photo_url: row.after_photo_url || null,
      });
      saved.current = JSON.stringify(row);
      onChange();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function remove() {
    if (!canDelete) return;
    if (!window.confirm("Delete this transformation?")) return;
    try {
      await api.deleteTransformation(item.id);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <input
          value={row.client_name}
          onChange={(e) => setRow({ ...row, client_name: e.target.value })}
          style={{ maxWidth: 240 }}
        />
        <button
          className="mini"
          onClick={remove}
          disabled={!canDelete}
          title={
            canDelete
              ? ""
              : "At least 2 transformations required — add another before removing one"
          }
        >
          Delete
        </button>
      </div>
      {!canDelete && (
        <p className="muted" style={{ fontSize: "0.8rem", margin: "4px 0 0" }}>
          At least 2 transformations required — add another before removing one.
        </p>
      )}
      <input
        placeholder="Caption"
        value={row.caption || ""}
        onChange={(e) => setRow({ ...row, caption: e.target.value })}
      />
      <div className="row" style={{ gap: 16, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          {row.before_photo_url && <img src={row.before_photo_url} alt="before" style={thumb} />}
          <input type="file" accept="image/*" onChange={(e) => pick(e, "before_photo_url")} disabled={busy} />
        </div>
        <div style={{ flex: 1 }}>
          {row.after_photo_url && <img src={row.after_photo_url} alt="after" style={thumb} />}
          <input type="file" accept="image/*" onChange={(e) => pick(e, "after_photo_url")} disabled={busy} />
        </div>
      </div>
      <SaveBar dirty={dirty} onSave={save} error={error} />
    </div>
  );
}

export default function Transformations() {
  const [items, setItems] = useState(null);
  const [draft, setDraft] = useState(BLANK);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.listTransformations().then(setItems).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function pickDraft(e, key) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDownscaledDataUrl(file, 900, 0.82);
      setDraft((d) => ({ ...d, [key]: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    setError("");
    if (!draft.client_name.trim()) return setError("Client name is required");
    try {
      await api.addTransformation({
        client_name: draft.client_name,
        caption: draft.caption || null,
        before_photo_url: draft.before_photo_url || null,
        after_photo_url: draft.after_photo_url || null,
      });
      setDraft(BLANK);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const count = items ? items.length : 0;

  return (
    <>
      <LandingContent />
      <LandingStats />

      <LandingContentProvider>
        <HeroEditor />
        <WhyChooseUsEditor />
        <TestimonialsEditor />
        <FaqEditor />
        <ContactEditor />
      </LandingContentProvider>

      <div className="card">
        <h1>Transformations</h1>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Shown on the public landing page. This section is trainer-only. Add as many
          as you like — at least 2 are always kept so the page never looks empty.
        </p>
        {error && <div className="error">{error}</div>}

        <h2>Add a transformation</h2>
        <label>Client name</label>
        <input value={draft.client_name} onChange={(e) => setDraft({ ...draft, client_name: e.target.value })} />
        <label>Caption</label>
        <input value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} placeholder="e.g. -8 kg in 12 weeks" />
        <div className="row" style={{ gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label>Before photo</label>
            <input type="file" accept="image/*" onChange={(e) => pickDraft(e, "before_photo_url")} disabled={busy} />
            {draft.before_photo_url && <img src={draft.before_photo_url} alt="" style={thumb} />}
          </div>
          <div style={{ flex: 1 }}>
            <label>After photo</label>
            <input type="file" accept="image/*" onChange={(e) => pickDraft(e, "after_photo_url")} disabled={busy} />
            {draft.after_photo_url && <img src={draft.after_photo_url} alt="" style={thumb} />}
          </div>
        </div>
        <button onClick={add} disabled={busy || !draft.client_name.trim()}>Add</button>
      </div>

      {(items || []).map((tr) => (
        <TransformationRow key={tr.id} item={tr} count={count} onChange={load} />
      ))}
      {items && items.length < 2 && (
        <p className="muted">
          Add at least 2 transformations — the public landing page always shows the gallery.
        </p>
      )}
    </>
  );
}
