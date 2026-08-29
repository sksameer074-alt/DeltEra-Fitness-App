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
      <h1>My meal plan</h1>
      {plan.updated_at ? (
        <p style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>
          Last updated {new Date(plan.updated_at).toLocaleString()}
        </p>
      ) : (
        <p style={{ color: "var(--text-2)" }}>Your trainer hasn't written a meal plan yet.</p>
      )}
      {plan.plan_text && <pre className="plan">{plan.plan_text}</pre>}
      <p style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>Read-only. Managed by your trainer.</p>
    </div>
  );
}
