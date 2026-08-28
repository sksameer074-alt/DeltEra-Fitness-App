import { useEffect, useState } from "react";
import { api, getStoredUser } from "../api";

export default function MyMealPlan() {
  const me = getStoredUser();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMealPlan(me.id).then(setPlan).catch((e) => setError(e.message));
  }, [me.id]);

  if (error) return <div className="card error">{error}</div>;
  if (!plan) return <div className="card">Loading…</div>;

  return (
    <div className="card">
      <h1>My Meal Plan</h1>
      {plan.updated_at ? (
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          Last updated {new Date(plan.updated_at).toLocaleString()}
        </p>
      ) : (
        <p style={{ color: "#888" }}>Your trainer hasn't written a meal plan yet.</p>
      )}
      {plan.plan_text && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 6,
            padding: 12,
          }}
        >
          {plan.plan_text}
        </pre>
      )}
      <p style={{ color: "#888", fontSize: "0.8rem" }}>Read-only. Managed by your trainer.</p>
    </div>
  );
}
