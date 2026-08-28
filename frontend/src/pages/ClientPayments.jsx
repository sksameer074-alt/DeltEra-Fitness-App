import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

const METHODS = ["Cash", "PhonePe", "UPI", "Bank Transfer", "Card", "Other"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const BLANK = { amount: "", method: "Cash", date: todayStr(), notes: "" };

export default function ClientPayments() {
  const { id } = useParams();
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState(BLANK);
  const [error, setError] = useState("");

  function load() {
    api.listPayments(id).then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function add() {
    setError("");
    const amount = Number(draft.amount);
    if (!(amount > 0)) return setError("Enter an amount greater than 0");
    try {
      await api.addPayment(id, { ...draft, amount, notes: draft.notes || null });
      setDraft(BLANK);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Payments</h1>
      <p style={{ color: "#b00020", fontSize: "0.85rem" }}>Trainer-only. Never shown to the client.</p>
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 8 }}>
        <div><label>Amount</label>
          <input type="number" min="1" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></div>
        <div><label>Method</label>
          <select value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value })}>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select></div>
        <div><label>Date</label>
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
        <div style={{ flex: 1 }}><label>Notes</label>
          <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
        <button onClick={add}>Add</button>
      </div>

      <table style={{ marginTop: 16 }}>
        <thead>
          <tr><th>Date</th><th>Amount</th><th>Method</th><th>Notes</th><th></th></tr>
        </thead>
        <tbody>
          {(rows || []).map((p) => (
            <tr key={p.id}>
              <td>{p.date}</td>
              <td>{p.amount}</td>
              <td>{p.method}</td>
              <td>{p.notes || "—"}</td>
              <td><button className="mini" onClick={async () => { await api.deletePayment(id, p.id); load(); }}>delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows && rows.length === 0 && <p>No payments recorded.</p>}
    </div>
  );
}
