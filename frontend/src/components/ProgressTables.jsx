export function WeightTable({ logs }) {
  if (!logs.length) return <p style={{ color: "#888" }}>No entries yet.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Weight (kg)</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((l) => (
          <tr key={l.id}>
            <td>{l.date}</td>
            <td>{l.weight}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MeasurementsTable({ rows }) {
  if (!rows.length) return <p style={{ color: "#888" }}>No entries yet.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Weight</th>
            <th>Chest</th>
            <th>Waist</th>
            <th>Thighs</th>
            <th>Arm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>{m.date}</td>
              <td>{m.weight ?? "—"}</td>
              <td>{m.chest_cm ?? "—"}</td>
              <td>{m.waist_cm ?? "—"}</td>
              <td>{m.thighs_cm ?? "—"}</td>
              <td>{m.arm_cm ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
