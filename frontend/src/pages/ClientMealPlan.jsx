import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, countWords, MEAL_PLAN_WORD_LIMIT } from "../api";

export default function ClientMealPlan() {
  const { id } = useParams();
  const [text, setText] = useState("");
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.getMealPlan(id).then((p) => {
      setText(p.plan_text || "");
      setMeta(p);
    }).catch((e) => setError(e.message));
  }, [id]);

  const words = countWords(text);
  const over = words > MEAL_PLAN_WORD_LIMIT;

  async function save() {
    setError("");
    setStatus("");
    try {
      const p = await api.saveMealPlan(id, text);
      setMeta(p);
      setStatus(`Saved · ${new Date(p.updated_at).toLocaleString()}`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Meal plan</h1>
      {meta?.updated_at && (
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          Last updated {new Date(meta.updated_at).toLocaleString()}
        </p>
      )}

      <textarea
        rows={18}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write the client's meal plan…"
      />
      <div className="row" style={{ alignItems: "center" }}>
        <span style={{ color: over ? "#b00020" : "#888", fontSize: "0.85rem" }}>
          {words.toLocaleString()} / {MEAL_PLAN_WORD_LIMIT.toLocaleString()} words
          {over && " — over the limit, trim before saving"}
        </span>
        <button onClick={save} disabled={over}>Save</button>
      </div>
      {status && <div style={{ color: "#2a7", fontSize: "0.85rem" }}>{status}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
