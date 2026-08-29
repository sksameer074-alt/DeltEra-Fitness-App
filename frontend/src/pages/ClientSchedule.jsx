import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, DAYS } from "../api";
import SaveBar from "../components/SaveBar.jsx";

const empty = () => DAYS.map(() => ({ enabled: false, time: "" }));

export default function ClientSchedule() {
  const { id } = useParams();
  const [rows, setRows] = useState(empty);
  const saved = useRef(JSON.stringify(empty()));
  const [error, setError] = useState("");

  useEffect(() => {
    api.getSchedule(id).then((entries) => {
      const next = DAYS.map((_, i) => {
        const found = entries.find((e) => e.day_of_week === i);
        return { enabled: !!found, time: found ? found.time : "" };
      });
      setRows(next);
      saved.current = JSON.stringify(next);
    }).catch((e) => setError(e.message));
  }, [id]);

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const dirty = JSON.stringify(rows) !== saved.current;

  async function save() {
    setError("");
    const entries = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].enabled) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rows[i].time)) {
          const msg = `Enter a time for ${DAYS[i]}`;
          setError(msg);
          throw new Error(msg);
        }
        entries.push({ day_of_week: i, time: rows[i].time });
      }
    }
    try {
      await api.setSchedule(id, entries);
      saved.current = JSON.stringify(rows);
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }

  return (
    <div className="card">
      <p><Link to={`/clients/${id}`}>← Back to client</Link></p>
      <h1>Schedule</h1>
      <p className="muted" style={{ fontSize: "0.85rem" }}>Times are IST (24-hour).</p>

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

      <SaveBar dirty={dirty} onSave={save} label="Save schedule" error={error} />
    </div>
  );
}
