import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

export default function ClientPackage() {
  const { id } = useParams();
  const [packages, setPackages] = useState(null);
  const [total, setTotal] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.listPackages(id).then(setPackages).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function create() {
    setError("");
    const n = Number(total);
    if (!Number.isInteger(n) || n <= 0) return setError("Enter a whole number greater than 0");
    try {
      await api.createPackage(id, n);
      setTotal("");
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const current = packages?.[0];

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Membership</h1>
      {error && <div className="error">{error}</div>}

      {current && (
        <div className="card" style={{ background: "#fafafa" }}>
          <strong>Current</strong>
          <div className="row"><span style={{ color: "#666" }}>Total purchased</span><span>{current.total_sessions}</span></div>
          <div className="row"><span style={{ color: "#666" }}>Used (auto)</span><span>{current.sessions_used}</span></div>
          <div className="row"><span style={{ color: "#666" }}>Remaining</span><span>{current.sessions_remaining}</span></div>
          <div className="row"><span style={{ color: "#666" }}>Started</span><span>{current.start_date}</span></div>
        </div>
      )}

      <h2>Create / renew membership</h2>
      <p style={{ color: "#888", fontSize: "0.85rem" }}>
        Enter the number of sessions purchased. This starts a fresh package (used = 0).
        The count then updates automatically whenever you mark a session done.
      </p>
      <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
        <div>
          <label>Total sessions</label>
          <input type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)} />
        </div>
        <button onClick={create}>Save package</button>
      </div>

      <h2 style={{ marginTop: 20 }}>History</h2>
      {packages === null ? (
        <p>Loading…</p>
      ) : packages.length === 0 ? (
        <p>No packages yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Started</th><th>Total</th><th>Used</th><th>Remaining</th></tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id}>
                <td>{p.start_date}</td>
                <td>{p.total_sessions}</td>
                <td>{p.sessions_used}</td>
                <td>{p.sessions_remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
