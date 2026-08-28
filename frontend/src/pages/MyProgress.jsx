import { useEffect, useState } from "react";
import { api, getStoredUser } from "../api";
import { MeasurementsTable, WeightTable } from "../components/ProgressTables.jsx";

const MEASURE_FIELDS = [
  ["weight", "Weight (kg)"],
  ["chest_cm", "Chest (cm)"],
  ["waist_cm", "Waist (cm)"],
  ["thighs_cm", "Thighs (cm)"],
  ["arm_cm", "Arm (cm)"],
];

function isoWeek(d) {
  const t = new Date(d);
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day);
  return t.toISOString().slice(0, 10);
}

export default function MyProgress() {
  const me = getStoredUser();
  const [logs, setLogs] = useState([]);
  const [rows, setRows] = useState([]);
  const [weight, setWeight] = useState("");
  const [measure, setMeasure] = useState({});
  const [error, setError] = useState("");

  function load() {
    api.listProgressLogs(me.id, 7).then(setLogs).catch((e) => setError(e.message));
    api.listMeasurements(me.id).then(setRows).catch(() => {});
  }
  useEffect(load, [me.id]);

  async function run(fn) {
    setError("");
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const loggedToday = logs.some((l) => l.date === new Date().toISOString().slice(0, 10));
  const loggedThisWeek = rows.some((m) => isoWeek(m.date) === isoWeek(new Date()));

  const submitWeight = () =>
    run(async () => {
      await api.logWeight(me.id, { weight: Number(weight) });
      setWeight("");
    });

  const submitMeasure = () =>
    run(async () => {
      const body = {};
      for (const [k] of MEASURE_FIELDS) if (measure[k] !== "" && measure[k] != null) body[k] = Number(measure[k]);
      await api.logMeasurements(me.id, body);
      setMeasure({});
    });

  return (
    <div className="card">
      <h1>My Progress</h1>
      {error && <div className="error">{error}</div>}

      <h2>Daily weight check-in</h2>
      <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
        <div>
          <label>Today's weight (kg)</label>
          <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <button onClick={submitWeight} disabled={!weight}>
          {loggedToday ? "Update today" : "Log today"}
        </button>
      </div>
      <h3 style={{ fontSize: "0.95rem", marginBottom: 4 }}>Last 7 days</h3>
      <WeightTable logs={logs} />

      <h2 style={{ marginTop: 24 }}>Weekly measurements</h2>
      {loggedThisWeek && (
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          Already logged this week — submitting again updates this week's entry.
        </p>
      )}
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {MEASURE_FIELDS.map(([k, label]) => (
          <div key={k} style={{ flex: "1 1 90px" }}>
            <label>{label}</label>
            <input
              type="number"
              step="0.1"
              value={measure[k] ?? ""}
              onChange={(e) => setMeasure({ ...measure, [k]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button onClick={submitMeasure}>Log measurements</button>
      <h3 style={{ fontSize: "0.95rem", margin: "12px 0 4px" }}>History</h3>
      <MeasurementsTable rows={rows} />
    </div>
  );
}
