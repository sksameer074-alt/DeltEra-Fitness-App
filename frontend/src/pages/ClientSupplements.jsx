import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

const BLANK = { name: "", dosage: "", notes: "" };

export default function ClientSupplements() {
  const { id } = useParams();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(BLANK);

  function load() {
    api.listSupplements(id).then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function run(fn) {
    setError("");
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const add = () =>
    run(async () => {
      await api.addSupplement(id, {
        name: draft.name,
        dosage: draft.dosage || null,
        notes: draft.notes || null,
      });
      setDraft(BLANK);
    });

  const patchRow = (rid, patch) =>
    setRows(rows.map((r) => (r.id === rid ? { ...r, ...patch } : r)));

  const saveRow = (r) =>
    run(() =>
      api.updateSupplement(id, r.id, {
        name: r.name,
        dosage: r.dosage || null,
        notes: r.notes || null,
      })
    );

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Supplements</h1>
      {error && <div className="error">{error}</div>}

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Dosage</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r) => (
            <tr key={r.id}>
              <td><input value={r.name} onChange={(e) => patchRow(r.id, { name: e.target.value })} /></td>
              <td><input value={r.dosage || ""} onChange={(e) => patchRow(r.id, { dosage: e.target.value })} /></td>
              <td><input value={r.notes || ""} onChange={(e) => patchRow(r.id, { notes: e.target.value })} /></td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="mini" onClick={() => saveRow(r)}>save</button>{" "}
                <button className="mini" onClick={() => run(() => api.deleteSupplement(id, r.id))}>delete</button>
              </td>
            </tr>
          ))}
          <tr>
            <td><input placeholder="e.g. Creatine" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
            <td><input placeholder="e.g. 5g/day" value={draft.dosage} onChange={(e) => setDraft({ ...draft, dosage: e.target.value })} /></td>
            <td><input placeholder="notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></td>
            <td><button className="mini" onClick={add} disabled={!draft.name}>add</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
