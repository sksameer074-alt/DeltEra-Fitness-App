import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { MeasurementsTable, WeightTable } from "../components/ProgressTables.jsx";

export default function ClientProgress() {
  const { id } = useParams();
  const [logs, setLogs] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listProgressLogs(id, 7).then(setLogs).catch((e) => setError(e.message));
    api.listMeasurements(id).then(setRows).catch(() => {});
  }, [id]);

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Progress</h1>
      <p style={{ color: "#888", fontSize: "0.85rem" }}>Read-only — logged by the client.</p>
      {error && <div className="error">{error}</div>}

      <h2>Daily weight — last 7 days</h2>
      <WeightTable logs={logs} />

      <h2 style={{ marginTop: 20 }}>Weekly measurements</h2>
      <MeasurementsTable rows={rows} />
    </div>
  );
}
