import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import TiltCard from "../components/TiltCard.jsx";

function packageTag(pkg) {
  if (!pkg) return null;
  if (pkg.sessions_remaining === 1) return "last session";
  if (pkg.sessions_remaining <= 0) return "no sessions left";
  return null;
}

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      api.listClients(search).then(setClients).catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h1>Clients</h1>
          <Link to="/clients/new"><button>New client</button></Link>
        </div>
        <input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
      </div>

      {clients.length === 0 ? (
        <div className="card"><p className="muted">No clients found.</p></div>
      ) : (
        <div className="client-grid">
          {clients.map((c) => (
            <TiltCard key={c.id} className="card client-card" max={5}>
              <Link to={`/clients/${c.id}`} className="client-card-link">
                <span className="avatar client-card-avatar">
                  {c.profile_photo_url
                    ? <img src={c.profile_photo_url} alt="" />
                    : (c.name || "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="client-card-body">
                  <div className="client-card-name">
                    {c.name}
                    {packageTag(c.package) && <span className="tag">{packageTag(c.package)}</span>}
                  </div>
                  <div className="muted client-card-phone">{c.phone_number}</div>
                  {c.feeling_note && (
                    <div className="client-card-feeling">“{c.feeling_note}”</div>
                  )}
                </div>
              </Link>
            </TiltCard>
          ))}
        </div>
      )}
    </>
  );
}
