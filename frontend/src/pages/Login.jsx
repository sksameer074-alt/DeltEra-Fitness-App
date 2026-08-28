import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setSession } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone_number: "", password: "" });
  const [error, setError] = useState("");

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.login(form);
      setSession(res.access_token, res.user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <h1>Log in</h1>
      <form onSubmit={submit}>
        <label>Phone number</label>
        <input name="phone_number" value={form.phone_number} onChange={update} required />
        <label>Password</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={update}
          required
        />
        <button type="submit">Log in</button>
      </form>
      {error && <div className="error">{error}</div>}
      <p>
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
