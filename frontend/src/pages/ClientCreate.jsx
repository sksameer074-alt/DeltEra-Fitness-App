import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import ClientForm from "../components/ClientForm.jsx";

export default function ClientCreate() {
  const navigate = useNavigate();

  async function handleSubmit(payload) {
    const created = await api.createClient(payload);
    navigate(`/clients/${created.id}`);
    return true; // navigated away
  }

  return (
    <div className="card">
      <p>
        <Link to="/clients">← Back to clients</Link>
      </p>
      <h1>New client</h1>
      <ClientForm mode="create" onSubmit={handleSubmit} submitLabel="Create client" />
    </div>
  );
}
