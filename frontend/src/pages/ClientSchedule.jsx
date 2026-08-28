import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, DAYS } from "../api";

export default function ClientSchedule() {
  const { id } = useParams();
  const navigate = useNavigate();
  // one row per weekday: { enabled, time }
  const [rows, setRows] = useState(DAYS.map(() => ({ enabled: false, time: "" })));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSchedule(id).then((entries) => {
      setRows(
        DAYS.map((_, i) => {
          const found = entries.find((e) => e.day_of_week === i);
          return { enabled: !!found, time: found ? found.time : "" };
        })
      );
    }).catch((e) => setError(e.message));
  }, [id]);

  function setRow(i, patch) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    setError("");
    const entries = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].enabled) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rows[i].time)) {
          setError(`Enter a time for ${DAYS[i]}`);
          return;
        }
        entries.push({ day_of_week: i, time: rows[i].time });
      }
    }
    setSaving(true);
    try {
      await api.setSchedule(id, entries);
      navigate(`/clients/${id}`);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <p>
        <Link to={`/clients/${id}`}>← Back to client</Link>
      </p>
      <h1>Edit weekly schedule</h1>
      <p style={{ color: "#888", fontSize: "0.85rem" }}>Times are IST (24-hour).</p>

      <table>
        <tbody>
          {DAYS.map((d, i) => (
            <tr key={d}>
              <td style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={rows[i].enabled}
                  onChange={(e) => setRow(i, { enabled: e.target.checked })}
                  style={{ width: "auto" }}
                />
              </td>
              <td style={{ width: 60 }}>{d}</td>
              <td>
                <input
                  type="time"
                  value={rows[i].time}
                  disabled={!rows[i].enabled}
                  onChange={(e) => setRow(i, { time: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save schedule"}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
