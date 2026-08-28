function Field({ label, value }) {
  const shown =
    value === null || value === "" || value === undefined ? "—" : String(value);
  return (
    <div className="row" style={{ padding: "4px 0" }}>
      <span style={{ color: "#666" }}>{label}</span>
      <span>{shown}</span>
    </div>
  );
}

export default function ProfileView({ user }) {
  return (
    <>
      <Field label="Name" value={user.name} />
      <Field label="Phone" value={user.phone_number} />
      <Field label="Role" value={user.role} />
      <Field label="Weight (kg)" value={user.weight} />
      <Field label="Height (cm)" value={user.height} />
      <Field label="Age" value={user.age} />
      <Field label="Sex" value={user.sex} />
      <Field label="Activity level" value={user.activity_level} />
      <Field label="Has injury" value={user.has_injury} />
      <Field label="Injury comment" value={user.injury_comment} />
      <Field label="Has health condition" value={user.has_health_condition} />
      <Field label="Health condition comment" value={user.health_condition_comment} />

      <h2 style={{ marginTop: 20 }}>Body metrics</h2>
      <Field label="BMI" value={user.bmi} />
      <Field label="BMR (kcal/day)" value={user.bmr} />
      <Field label="TDEE (kcal/day)" value={user.tdee} />
      <p style={{ color: "#888", fontSize: "0.8rem" }}>
        Entered by your trainer. Not auto-calculated.
      </p>
    </>
  );
}
