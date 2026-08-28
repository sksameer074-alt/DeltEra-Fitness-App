import { useEffect, useState } from "react";
import { api } from "../api";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.analytics().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card error">{error}</div>;
  if (!data) return <div className="card">Loading…</div>;

  const totalRevenue = data.monthly_revenue.reduce((s, m) => s + m.total, 0);

  return (
    <div className="card">
      <h1>Analytics</h1>

      <div style={{ margin: "12px 0" }}>
        <span className="counter"><strong>{data.active_clients}</strong> active clients</span>
        <span className="counter"><strong>{data.clients_last_session_or_zero}</strong> on last / 0 sessions</span>
        <span className="counter"><strong>{totalRevenue}</strong> total revenue</span>
      </div>

      <h2>Attendance (done vs missed)</h2>
      {data.attendance.length === 0 ? (
        <p style={{ color: "#888" }}>No clients.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Client</th><th>Done</th><th>Missed</th><th>Rate</th></tr>
          </thead>
          <tbody>
            {data.attendance.map((a) => (
              <tr key={a.client_id}>
                <td>{a.name}</td>
                <td>{a.done}</td>
                <td>{a.missed}</td>
                <td>{a.attendance_rate == null ? "—" : `${Math.round(a.attendance_rate * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 20 }}>Monthly revenue</h2>
      {data.monthly_revenue.length === 0 ? (
        <p style={{ color: "#888" }}>No payments recorded.</p>
      ) : (
        <table>
          <thead><tr><th>Month</th><th>Total</th></tr></thead>
          <tbody>
            {data.monthly_revenue.map((m) => (
              <tr key={m.month}><td>{m.month}</td><td>{m.total}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
