import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

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
    <div className="card">
      <div className="row" style={{ alignItems: "center" }}>
        <h1>Clients</h1>
        <Link to="/clients/new">
          <button>New client</button>
        </Link>
      </div>

      <input
        placeholder="Search by name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="error">{error}</div>}

      {clients.length === 0 ? (
        <p>No clients found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="avatar">
                    {c.profile_photo_url
                      ? <img src={c.profile_photo_url} alt="" />
                      : (c.name || "?").slice(0, 1).toUpperCase()}
                  </span>{" "}
                  {c.name}
                  {packageTag(c.package) && <span className="tag">{packageTag(c.package)}</span>}
                  {c.feeling_note && (
                    <div style={{ color: "var(--text-2)", fontSize: "0.78rem" }}>“{c.feeling_note}”</div>
                  )}
                </td>
                <td>{c.phone_number}</td>
                <td>
                  <Link to={`/clients/${c.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
