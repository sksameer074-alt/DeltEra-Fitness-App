import { useEffect, useState } from "react";
import { api, getStoredUser } from "../api";

export default function MySupplements() {
  const me = getStoredUser();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listSupplements(me.id).then(setRows).catch((e) => setError(e.message));
  }, [me.id]);

  if (error) return <div className="card error">{error}</div>;
  if (!rows) return <div className="card">Loading…</div>;

  return (
    <div className="card">
      <h1>My supplements</h1>
      {rows.length === 0 ? (
        <p>No supplements yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Dosage</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.dosage || "—"}</td>
                <td>{r.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>Read-only. Managed by your trainer.</p>
    </div>
  );
}
