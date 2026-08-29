import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import CountUp from "../components/CountUp.jsx";

export default function Landing() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.landing().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card error">{error}</div>;
  if (!data) return <div className="card">Loading…</div>;

  const t = data.trainer;
  const stats = data.stats || {};

  return (
    <div className="landing">
      <div className="card">
        <div className="landing-hero">
          <span className="avatar">
            {t?.profile_photo_url
              ? <img src={t.profile_photo_url} alt="" />
              : (t?.name || "D").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1>{t?.name || "Delt_era Fitness"}</h1>
            {t?.credentials && <div className="muted">{t.credentials}</div>}
          </div>
        </div>

        {t?.bio && <p style={{ marginTop: 14 }}>{t.bio}</p>}

        <div className="cta">
          <Link to="/signup" className="btn btn-primary">Sign up</Link>
          <Link to="/login" className="btn btn-secondary">Log in</Link>
        </div>
      </div>

      <div className="card landing-stats">
        <div className="stat">
          <CountUp to={stats.clients || 0} suffix="+" />
          <div className="muted">clients</div>
        </div>
        <div className="stat">
          <CountUp to={stats.transformations || 0} suffix="+" delay={0.15} />
          <div className="muted">transformations</div>
        </div>
        <div className="stat">
          <CountUp to={stats.sessions || 0} suffix="+" delay={0.3} />
          <div className="muted">sessions completed</div>
        </div>
      </div>

      <h2>Transformations</h2>
      {data.transformations.length === 0 ? (
        <p className="muted">No transformations posted yet.</p>
      ) : (
        <div className="transform-grid">
          {data.transformations.map((tr, i) => (
            <motion.div
              key={tr.id}
              className="transform-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.32, delay: Math.min(i * 0.04, 0.2) }}
            >
              <div className="ba">
                <figure>
                  {tr.before_photo_url && <img src={tr.before_photo_url} alt="before" />}
                  <figcaption>Before</figcaption>
                </figure>
                <figure>
                  {tr.after_photo_url && <img src={tr.after_photo_url} alt="after" />}
                  <figcaption>After</figcaption>
                </figure>
              </div>
              {tr.caption && (
                <div className="cap">
                  <strong>{tr.client_name}</strong> — {tr.caption}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
