import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ClientForm from "../components/ClientForm.jsx";

export default function ClientEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getUser(id).then(setUser).catch((e) => setError(e.message));
  }, [id]);

  async function handleSubmit(payload) {
    // phone/password are not part of an edit
    delete payload.phone_number;
    delete payload.password;
    await api.updateClient(id, payload);
    navigate(`/clients/${id}`);
  }

  return (
    <div className="card">
      <p>
        <Link to={`/clients/${id}`}>← Back to client</Link>
      </p>
      <h1>Edit profile</h1>
      {error && <div className="error">{error}</div>}
      {!user ? (
        <p>Loading…</p>
      ) : (
        <ClientForm mode="edit" initial={user} onSubmit={handleSubmit} submitLabel="Save changes" />
      )}
    </div>
  );
}
