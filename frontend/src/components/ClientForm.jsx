import { useMemo, useState } from "react";
import { passwordError, phoneError } from "../api";
import { useUnsavedGuard } from "../hooks.js";

const SEX_OPTIONS = ["male", "female", "other"];
const ACTIVITY_OPTIONS = ["lightly active", "moderately active", "very active"];

const EMPTY = {
  name: "",
  phone_number: "",
  password: "",
  weight: "",
  height: "",
  age: "",
  sex: "",
  activity_level: "",
  bmi: "",
  bmr: "",
  tdee: "",
  has_injury: false,
  injury_comment: "",
  has_health_condition: false,
  health_condition_comment: "",
};

/**
 * mode: "create" shows phone + password; "edit" hides them (not editable per spec).
 * onSubmit receives a cleaned payload object.
 */
export default function ClientForm({ mode, initial, onSubmit, submitLabel }) {
  const start = useMemo(() => ({ ...EMPTY, ...toStrings(initial) }), [initial]);
  const [form, setForm] = useState(start);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(start));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(form) !== savedSnapshot;
  useUnsavedGuard(dirty && !saving);

  function update(e) {
    const { name, value, type, checked } = e.target;
    setSaved(false);
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  }

  const phoneErr = mode === "create" && form.phone_number ? phoneError(form.phone_number) : "";
  const pwErr = mode === "create" && form.password ? passwordError(form.password) : "";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (mode === "create" && (phoneError(form.phone_number) || passwordError(form.password))) {
      setError(phoneError(form.phone_number) || passwordError(form.password));
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name,
      weight: form.weight === "" ? null : Number(form.weight),
      height: form.height === "" ? null : Number(form.height),
      age: form.age === "" ? null : Number(form.age),
      sex: form.sex || null,
      activity_level: form.activity_level || null,
      bmi: form.bmi === "" ? null : Number(form.bmi),
      bmr: form.bmr === "" ? null : Number(form.bmr),
      tdee: form.tdee === "" ? null : Number(form.tdee),
      has_injury: form.has_injury,
      injury_comment: form.has_injury ? form.injury_comment : null,
      has_health_condition: form.has_health_condition,
      health_condition_comment: form.has_health_condition
        ? form.health_condition_comment
        : null,
    };
    if (mode === "create") {
      payload.phone_number = form.phone_number;
      payload.password = form.password;
    }

    try {
      const navigated = await onSubmit(payload);
      if (!navigated) {
        // parent stayed on the page (edit) — reflect the save here
        setSavedSnapshot(JSON.stringify(form));
        setSaved(true);
        setSaving(false);
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>Name</label>
      <input name="name" value={form.name} onChange={update} required />

      {mode === "create" && (
        <>
          <label>Phone number (10 digits)</label>
          <input
            name="phone_number"
            value={form.phone_number}
            onChange={update}
            inputMode="numeric"
            maxLength={10}
            required
          />
          {phoneErr && <div className="error">{phoneErr}</div>}
          <label>Password (min 6 characters)</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={update}
            minLength={6}
            required
          />
          {pwErr && <div className="error">{pwErr}</div>}
        </>
      )}

      <div className="row">
        <div style={{ flex: 1 }}>
          <label>Weight (kg)</label>
          <input name="weight" type="number" step="0.1" value={form.weight} onChange={update} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Height (cm)</label>
          <input name="height" type="number" step="0.1" value={form.height} onChange={update} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Age</label>
          <input name="age" type="number" value={form.age} onChange={update} />
        </div>
      </div>

      <label>Sex</label>
      <select name="sex" value={form.sex} onChange={update}>
        <option value="">Select…</option>
        {SEX_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {cap(o)}
          </option>
        ))}
      </select>

      <label>Activity level</label>
      <select name="activity_level" value={form.activity_level} onChange={update}>
        <option value="">Select…</option>
        {ACTIVITY_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {cap(o)}
          </option>
        ))}
      </select>

      <h2 style={{ marginTop: 16 }}>Body metrics (entered by trainer)</h2>
      <div className="row">
        <div style={{ flex: 1 }}>
          <label>BMI</label>
          <input name="bmi" type="number" step="0.1" value={form.bmi} onChange={update} />
        </div>
        <div style={{ flex: 1 }}>
          <label>BMR (kcal/day)</label>
          <input name="bmr" type="number" step="1" value={form.bmr} onChange={update} />
        </div>
        <div style={{ flex: 1 }}>
          <label>TDEE (kcal/day)</label>
          <input name="tdee" type="number" step="1" value={form.tdee} onChange={update} />
        </div>
      </div>

      <label style={{ marginTop: 16 }}>
        <input
          type="checkbox"
          name="has_injury"
          checked={form.has_injury}
          onChange={update}
          style={{ width: "auto", marginRight: 6 }}
        />
        Has injury
      </label>
      {form.has_injury && (
        <input
          name="injury_comment"
          placeholder="Injury comment"
          value={form.injury_comment}
          onChange={update}
        />
      )}

      <label>
        <input
          type="checkbox"
          name="has_health_condition"
          checked={form.has_health_condition}
          onChange={update}
          style={{ width: "auto", marginRight: 6 }}
        />
        Has health condition
      </label>
      {form.has_health_condition && (
        <input
          name="health_condition_comment"
          placeholder="Health condition comment"
          value={form.health_condition_comment}
          onChange={update}
        />
      )}

      <div className="savebar">
        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: 0 }}
          disabled={saving || !!phoneErr || !!pwErr || (mode === "edit" && !dirty)}
        >
          {saving ? "Saving…" : submitLabel}
        </button>
        {saved && !dirty && <span className="toast">Saved</span>}
        {dirty && !saving && mode === "edit" && <span className="unsaved-note">Unsaved changes</span>}
      </div>
      {error && <div className="error">{error}</div>}
    </form>
  );
}

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function toStrings(obj) {
  if (!obj) return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === null || v === undefined ? (typeof v === "boolean" ? v : "") : v;
  }
  return out;
}
