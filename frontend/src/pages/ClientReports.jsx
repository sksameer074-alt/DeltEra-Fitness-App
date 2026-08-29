import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

export default function ClientReports() {
  const { id } = useParams();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listReports(id).then(setReports).catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Reports</h1>
      <p style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>Read-only — uploaded by the client.</p>
      {error && <div className="error">{error}</div>}
      {reports === null ? (
        <p>Loading…</p>
      ) : reports.length === 0 ? (
        <p>No reports uploaded.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {reports.map((r) => (
            <li key={r.id} style={{ marginBottom: 8 }}>
              <a href={r.file_url} target="_blank" rel="noreferrer">{r.note || "report"}</a>
              <span style={{ color: "var(--text-2)", fontSize: "0.75rem", marginLeft: 8 }}>
                {new Date(r.uploaded_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
