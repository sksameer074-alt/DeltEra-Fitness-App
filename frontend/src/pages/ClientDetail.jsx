import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, packageBannerText, passwordError } from "../api";
import ProfileView from "../components/ProfileView.jsx";
import SessionCalendar from "../components/SessionCalendar.jsx";

function ResetPassword({ clientId }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const pwErr = pw ? passwordError(pw) : "";

  async function submit() {
    setErr("");
    setMsg("");
    if (passwordError(pw)) return setErr(passwordError(pw));
    try {
      await api.resetClientPassword(clientId, pw);
      setMsg("Password reset. Share the new password with the client.");
      setPw("");
      setOpen(false);
    } catch (e) {
      setErr(e.message);
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 8 }}>
        <button onClick={() => setOpen(true)}>Reset password</button>
        {msg && <div style={{ color: "#2a7", fontSize: "0.85rem" }}>{msg}</div>}
      </div>
    );
  }
  return (
    <div className="card" style={{ background: "#fafafa", marginTop: 8 }}>
      <label>New temporary password (min 6 characters)</label>
      <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      {pwErr && <div className="error">{pwErr}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={!!pwErr || !pw}>Set password</button>
        <button className="link" onClick={() => { setOpen(false); setPw(""); setErr(""); }}>Cancel</button>
      </div>
      {err && <div className="error">{err}</div>}
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getUser(id).then(setUser).catch((e) => setError(e.message));
    api.sessionSummary(id).then(setSummary).catch(() => {});
  }, [id]);

  const pkg = user?.package;
  const alert = packageBannerText(pkg);

  return (
    <div className="card">
      <p><Link to="/clients">← Back to clients</Link></p>
      {error && <div className="error">{error}</div>}
      {!error && !user && <p>Loading…</p>}
      {user && (
        <>
          <h1>{user.name}</h1>
          {alert && <div className="banner">{alert}</div>}

          <div className="toolbar">
            <Link to={`/clients/${id}/edit`}><button>Edit profile</button></Link>
            <Link to={`/clients/${id}/schedule`}><button>Schedule</button></Link>
            <Link to={`/clients/${id}/workouts`}><button>Workouts</button></Link>
            <Link to={`/clients/${id}/meal-plan`}><button>Meal plan</button></Link>
            <Link to={`/clients/${id}/supplements`}><button>Supplements</button></Link>
            <Link to={`/clients/${id}/progress`}><button>Progress</button></Link>
            <Link to={`/clients/${id}/daily-check-in`}><button>Daily Check-in</button></Link>
            <Link to={`/clients/${id}/reports`}><button>Reports</button></Link>
            <Link to={`/clients/${id}/membership`}><button>Membership</button></Link>
            <Link to={`/clients/${id}/payments`}><button>Payments</button></Link>
            <Link to={`/clients/${id}/notes`}><button>Notes</button></Link>
          </div>
          <ResetPassword clientId={id} />

          {pkg && (
            <p style={{ color: "#666", fontSize: "0.9rem" }}>
              Membership: {pkg.sessions_used}/{pkg.total_sessions} used · {pkg.sessions_remaining} remaining
            </p>
          )}

          <ProfileView user={user} />

          <h2 style={{ marginTop: 24 }}>This week</h2>
          {summary ? (
            <>
              <div style={{ margin: "8px 0" }}>
                <span className="counter"><strong>{summary.done}</strong> done</span>
                <span className="counter"><strong>{summary.remaining}</strong> remaining</span>
                <span className="counter"><strong>{summary.missed}</strong> missed</span>
              </div>
              <SessionCalendar sessions={summary.sessions} />
            </>
          ) : (
            <p style={{ color: "#888" }}>No session data.</p>
          )}
        </>
      )}
    </div>
  );
}
