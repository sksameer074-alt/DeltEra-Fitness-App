import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, countWords, MEAL_PLAN_WORD_LIMIT } from "../api";
import SaveBar from "../components/SaveBar.jsx";

export default function ClientMealPlan() {
  const { id } = useParams();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMealPlan(id).then((p) => {
      setText(p.plan_text || "");
      setSaved(p.plan_text || "");
      setMeta(p);
    }).catch((e) => setError(e.message));
  }, [id]);

  const words = countWords(text);
  const over = words > MEAL_PLAN_WORD_LIMIT;
  const dirty = text !== saved;

  async function save() {
    setError("");
    try {
      const p = await api.saveMealPlan(id, text);
      setMeta(p);
      setSaved(text);
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Meal plan</h1>
      {meta?.updated_at && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Last updated {new Date(meta.updated_at).toLocaleString()}
        </p>
      )}

      <textarea
        rows={18}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write the client's meal plan…"
      />
      <span
        className="muted"
        style={{ fontSize: "0.85rem", color: over ? "var(--danger)" : "var(--text-2)" }}
      >
        {words.toLocaleString()} / {MEAL_PLAN_WORD_LIMIT.toLocaleString()} words
        {over && " — over the limit, trim before saving"}
      </span>

      <SaveBar dirty={dirty} onSave={save} disabled={over} error={error} />
    </div>
  );
}
