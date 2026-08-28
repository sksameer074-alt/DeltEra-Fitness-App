import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, passwordError, phoneError, setSession } from "../api";

const SEX_OPTIONS = ["male", "female", "other"];
const ACTIVITY_OPTIONS = ["lightly active", "moderately active", "very active"];

const initial = {
  name: "",
  phone_number: "",
  password: "",
  role: "client",
  weight: "",
  height: "",
  age: "",
  sex: "",
  activity_level: "",
  has_injury: false,
  injury_comment: "",
  has_health_condition: false,
  health_condition_comment: "",
};

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");

  const isClient = form.role === "client";
  const phoneErr = form.phone_number ? phoneError(form.phone_number) : "";
  const pwErr = form.password ? passwordError(form.password) : "";

  function update(e) {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (phoneError(form.phone_number) || passwordError(form.password)) {
      setError(phoneError(form.phone_number) || passwordError(form.password));
      return;
    }

    // Trainers only provide name / phone / password.
    let payload = {
      name: form.name,
      phone_number: form.phone_number,
      password: form.password,
      role: form.role,
    };

    if (isClient) {
      payload = {
        ...payload,
        weight: form.weight ? Number(form.weight) : null,
        height: form.height ? Number(form.height) : null,
        age: form.age ? Number(form.age) : null,
        sex: form.sex || null,
        activity_level: form.activity_level || null,
        has_injury: form.has_injury,
        injury_comment: form.has_injury ? form.injury_comment : null,
        has_health_condition: form.has_health_condition,
        health_condition_comment: form.has_health_condition
          ? form.health_condition_comment
          : null,
      };
    }

    try {
      const res = await api.signup(payload);
      setSession(res.access_token, res.user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <h1>Create your account</h1>
      <form onSubmit={submit}>
        <label>I am a…</label>
        <select name="role" value={form.role} onChange={update}>
          <option value="client">Client</option>
          <option value="trainer">Trainer</option>
        </select>

        <label>Name</label>
        <input name="name" value={form.name} onChange={update} required />

        <label>Phone number (10 digits)</label>
        <input
          name="phone_number"
          value={form.phone_number}
          onChange={update}
          inputMode="numeric"
          maxLength={10}
          required
        />
        {phoneErr && <div className="error">{phoneErr}</div>}

        <label>Password (min 6 characters)</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={update}
          minLength={6}
          required
        />
        {pwErr && <div className="error">{pwErr}</div>}

        {isClient && (
          <>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label>Weight (kg)</label>
                <input name="weight" type="number" step="0.1" value={form.weight} onChange={update} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Height (cm)</label>
                <input name="height" type="number" step="0.1" value={form.height} onChange={update} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Age</label>
                <input name="age" type="number" value={form.age} onChange={update} />
              </div>
            </div>

            <label>Sex</label>
            <select name="sex" value={form.sex} onChange={update}>
              <option value="">Select…</option>
              {SEX_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o[0].toUpperCase() + o.slice(1)}
                </option>
              ))}
            </select>

            <label>Activity level</label>
            <select name="activity_level" value={form.activity_level} onChange={update}>
              <option value="">Select…</option>
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o[0].toUpperCase() + o.slice(1)}
                </option>
              ))}
            </select>

            <label style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                name="has_injury"
                checked={form.has_injury}
                onChange={update}
                style={{ width: "auto", marginRight: 6 }}
              />
              I have an injury
            </label>
            {form.has_injury && (
              <input
                name="injury_comment"
                placeholder="Tell us about the injury"
                value={form.injury_comment}
                onChange={update}
              />
            )}

            <label>
              <input
                type="checkbox"
                name="has_health_condition"
                checked={form.has_health_condition}
                onChange={update}
                style={{ width: "auto", marginRight: 6 }}
              />
              I have a health condition
            </label>
            {form.has_health_condition && (
              <input
                name="health_condition_comment"
                placeholder="Tell us about the health condition"
                value={form.health_condition_comment}
                onChange={update}
              />
            )}
          </>
        )}

        <button type="submit" disabled={!!phoneErr || !!pwErr}>Create account</button>
      </form>
      {error && <div className="error">{error}</div>}
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
