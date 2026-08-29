import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import SaveBar from "../components/SaveBar.jsx";

const BLANK = { name: "", dosage: "", notes: "" };

export default function ClientSupplements() {
  const { id } = useParams();
  const [rows, setRows] = useState([]);
  const original = useRef({});
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(BLANK);

  function load() {
    api.listSupplements(id).then((data) => {
      setRows(data);
      original.current = Object.fromEntries(data.map((r) => [r.id, JSON.stringify(r)]));
    }).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  const patchRow = (rid, patch) =>
    setRows((rs) => rs.map((r) => (r.id === rid ? { ...r, ...patch } : r)));

  const dirty = rows.some((r) => JSON.stringify(r) !== original.current[r.id]);

  async function saveAll() {
    setError("");
    try {
      for (const r of rows) {
        if (JSON.stringify(r) !== original.current[r.id]) {
          await api.updateSupplement(id, r.id, {
            name: r.name,
            dosage: r.dosage || null,
            notes: r.notes || null,
          });
        }
      }
      load();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }

  async function add() {
    setError("");
    try {
      await api.addSupplement(id, {
        name: draft.name,
        dosage: draft.dosage || null,
        notes: draft.notes || null,
      });
      setDraft(BLANK);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(rid) {
    setError("");
    if (!window.confirm("Delete this supplement?")) return;
    try {
      await api.deleteSupplement(id, rid);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Supplements</h1>
      {error && <div className="error">{error}</div>}

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr><th>Name</th><th>Dosage</th><th>Notes</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><input value={r.name} onChange={(e) => patchRow(r.id, { name: e.target.value })} /></td>
              <td><input value={r.dosage || ""} onChange={(e) => patchRow(r.id, { dosage: e.target.value })} /></td>
              <td><input value={r.notes || ""} onChange={(e) => patchRow(r.id, { notes: e.target.value })} /></td>
              <td><button className="mini" onClick={() => remove(r.id)}>Delete</button></td>
            </tr>
          ))}
          <tr>
            <td><input placeholder="e.g. Creatine" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
            <td><input placeholder="e.g. 5 g / day" value={draft.dosage} onChange={(e) => setDraft({ ...draft, dosage: e.target.value })} /></td>
            <td><input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></td>
            <td><button className="mini" onClick={add} disabled={!draft.name.trim()}>Add</button></td>
          </tr>
        </tbody>
      </table>

      <SaveBar dirty={dirty} onSave={saveAll} label="Save changes" />
    </div>
  );
}
