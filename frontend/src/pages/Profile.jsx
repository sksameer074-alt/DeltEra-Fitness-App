import { useEffect, useState } from "react";
import { api, computeStreak, passwordError } from "../api";
import ProfileView from "../components/ProfileView.jsx";
import { fileToDownscaledDataUrl } from "../components/imageFile.js";

function Avatar({ url, name }) {
  return (
    <span className="avatar" style={{ width: 64, height: 64, fontSize: "1.4rem" }}>
      {url ? <img src={url} alt="" /> : (name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function ChangePassword() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const pwErr = next ? passwordError(next) : "";

  async function submit(e) {
    e.preventDefault();
    setMsg(""); setErr("");
    if (passwordError(next)) return setErr(passwordError(next));
    try {
      await api.changeMyPassword(cur, next);
      setCur(""); setNext(""); setMsg("Password changed.");
    } catch (e2) { setErr(e2.message); }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <label>Current password</label>
      <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required />
      <label>New password (min 6 characters)</label>
      <input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={6} required />
      {pwErr && <div className="error">{pwErr}</div>}
      <button type="submit" disabled={!!pwErr}>Change password</button>
      {msg && <div style={{ color: "#2a7", fontSize: "0.85rem" }}>{msg}</div>}
      {err && <div className="error">{err}</div>}
    </form>
  );
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [streak, setStreak] = useState(0);
  const [announcement, setAnnouncement] = useState(null);
  const [feeling, setFeeling] = useState("");
  const [feelMsg, setFeelMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then((u) => {
      setUser(u);
      setFeeling(u.feeling_note || "");
      api.listSessions(u.id).then((s) => setStreak(computeStreak(s))).catch(() => {});
    }).catch((e) => setError(e.message));
    api.latestAnnouncement().then(setAnnouncement).catch(() => {});
  }, []);

  if (error) return <div className="card error">{error}</div>;
  if (!user) return <div className="card">Loading…</div>;

  const pkg = user.package;

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDownscaledDataUrl(file, 512, 0.85);
      const updated = await api.updateMe({ profile_photo_url: url });
      setUser(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveFeeling() {
    setFeelMsg("");
    try {
      const updated = await api.updateMe({ feeling_note: feeling });
      setUser(updated);
      setFeelMsg("Saved");
    } catch (e) {
      setFeelMsg(e.message);
    }
  }

  return (
    <>
      {announcement && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Announcement</h2>
          <div className="announcement">{announcement.message}</div>
          <div style={{ color: "#888", fontSize: "0.75rem", marginTop: 4 }}>
            {new Date(announcement.created_at).toLocaleString()}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar url={user.profile_photo_url} name={user.name} />
          <div>
            <h1 style={{ margin: 0 }}>{user.name}</h1>
            {streak > 0 && <span className="streak-badge">🔥 {streak}-session streak</span>}
          </div>
        </div>
        <label style={{ marginTop: 10 }}>Profile photo</label>
        <input type="file" accept="image/*" onChange={onPhoto} disabled={busy} />
        {busy && <span style={{ marginLeft: 8 }}>uploading…</span>}

        <label style={{ marginTop: 12 }}>How are you feeling today?</label>
        <input value={feeling} onChange={(e) => setFeeling(e.target.value)} placeholder="Short note…" />
        <button onClick={saveFeeling}>Save note</button>
        {feelMsg && <span style={{ color: "#2a7", fontSize: "0.85rem", marginLeft: 8 }}>{feelMsg}</span>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>My Profile</h2>
        <ProfileView user={user} />
        <p style={{ color: "#888", fontSize: "0.85rem", marginTop: 16 }}>
          Your trainer manages these details. Contact them to make changes.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Membership</h2>
        {pkg ? (
          <>
            <div className="row"><span style={{ color: "#666" }}>Sessions purchased</span><span>{pkg.total_sessions}</span></div>
            <div className="row"><span style={{ color: "#666" }}>Used</span><span>{pkg.sessions_used}</span></div>
            <div className="row"><span style={{ color: "#666" }}>Remaining</span><span>{pkg.sessions_remaining}</span></div>
          </>
        ) : (
          <p style={{ color: "#888" }}>No active membership.</p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Change password</h2>
        <ChangePassword />
      </div>
    </>
  );
}
