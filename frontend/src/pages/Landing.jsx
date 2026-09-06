import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, getStoredUser } from "../api";
import CountUp from "../components/CountUp.jsx";
import TiltCard from "../components/TiltCard.jsx";
import BeforeAfterSlider from "../components/BeforeAfterSlider.jsx";
import { useInViewOnce, useMediaQuery, usePrefersReducedMotion } from "../hooks.js";

// Staggered fade + slide-up as each block scrolls into view (IntersectionObserver
// + CSS). Falls back to visible if the observer never fires; no motion at all
// under prefers-reduced-motion.
function Reveal({ children, delay = 0, className = "" }) {
  const reduce = usePrefersReducedMotion();
  const [ref, inView] = useInViewOnce();
  const shown = reduce || inView;
  return (
    <div
      ref={ref}
      className={`l-reveal ${className} ${shown ? "is-in" : ""}`.trim()}
      style={reduce ? undefined : { transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

function instaHref(v) {
  const s = (v || "").trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `https://instagram.com/${s.replace(/^@/, "")}`;
}
function instaLabel(v) {
  const s = (v || "").trim();
  if (/^https?:\/\//i.test(s)) return s.replace(/^https?:\/\/(www\.)?/i, "");
  return s.startsWith("@") ? s : `@${s}`;
}

export default function Landing() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showBook, setShowBook] = useState(false);

  const reduce = usePrefersReducedMotion();
  const finePointer = useMediaQuery("(pointer: fine)");
  const heroRef = useRef(null);
  const heroEndRef = useRef(null);
  const user = getStoredUser();

  useEffect(() => {
    api.landing().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const el = heroEndRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setShowBook(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [data]);

  function onHeroMove(e) {
    if (!finePointer || reduce) return;
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--gx", `${e.clientX - r.left}px`);
    el.style.setProperty("--gy", `${e.clientY - r.top}px`);
  }

  if (error) return <div className="card error">{error}</div>;
  if (!data) return <div className="landing-v2 l-loading">Loading…</div>;

  const t = data.trainer;
  const stats = data.stats || {};
  const c = data.content || {};
  const why = (c.why_choose_us || []).filter(
    (x) => `${x.title || ""}${x.description || ""}`.trim()
  );
  const testimonials = (c.testimonials || []).filter((x) => (x.quote || "").trim());
  const faq = (c.faq || []).filter((x) => (x.question || "").trim());
  const headline = (c.hero_headline || "").trim() || t?.name || "Delt_era Fitness";
  const sub = (c.hero_subheadline || "").trim() || t?.bio || "";
  const bookTo = user ? "/" : "/signup";

  const STATS = [
    { n: stats.clients || 0, label: "clients" },
    { n: stats.transformations || 0, label: "transformations" },
    { n: stats.sessions || 0, label: "sessions completed" },
  ];

  return (
    <div className="landing-v2">
        <section className="l-hero" ref={heroRef} onMouseMove={onHeroMove}>
          <div className="l-hero-glow" aria-hidden="true" />
          <div className="l-wrap l-hero-inner">
            <p className="l-eyebrow">Delt_era Fitness</p>
            <h1 className="l-h1">{headline}</h1>
            {sub && <p className="l-sub">{sub}</p>}
            <div className="l-cta">
              <Link className="l-btn l-btn-primary" to="/signup">Sign up</Link>
              <Link className="l-btn l-btn-ghost" to="/login">Log in</Link>
            </div>
          </div>
          <span ref={heroEndRef} className="l-hero-end" aria-hidden="true" />
        </section>

        <section className="l-section">
          <div className="l-wrap l-stats">
            {STATS.map((s, i) => (
              <Reveal key={s.label} className="l-glass l-stat" delay={i * 0.12}>
                <CountUp to={s.n} suffix="+" />
                <span className="l-stat-label">{s.label}</span>
              </Reveal>
            ))}
          </div>
        </section>

        {why.length > 0 && (
          <section className="l-section">
            <div className="l-wrap">
              <h2 className="l-h2">Why train here</h2>
              <div className="l-grid-3">
                {why.map((w, i) => (
                  <Reveal key={i} delay={i * 0.08}>
                    <TiltCard className="l-glass l-why">
                      <h3>{w.title || "—"}</h3>
                      {w.description && <p>{w.description}</p>}
                    </TiltCard>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {data.transformations.length > 0 && (
          <section className="l-section">
            <div className="l-wrap">
              <h2 className="l-h2">Transformations</h2>
              <div className="l-grid-2">
                {data.transformations.map((tr, i) => (
                  <Reveal key={tr.id} delay={Math.min(i * 0.05, 0.25)}>
                    <TiltCard className="l-glass l-transform" max={4}>
                      <BeforeAfterSlider
                        before={tr.before_photo_url}
                        after={tr.after_photo_url}
                        label={tr.client_name}
                      />
                      <div className="l-transform-cap">
                        <strong>{tr.client_name}</strong>
                        {tr.caption ? ` — ${tr.caption}` : ""}
                      </div>
                    </TiltCard>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {testimonials.length > 0 && (
          <section className="l-section">
            <div className="l-wrap">
              <h2 className="l-h2">What clients say</h2>
              <div className="l-grid-2">
                {testimonials.map((tm, i) => (
                  <Reveal key={i} delay={i * 0.06}>
                    <TiltCard className="l-glass l-quote">
                      <div className="l-stars" aria-label={`${tm.rating} out of 5 stars`}>
                        {"★★★★★".slice(0, tm.rating)}
                        <span className="l-stars-off">{"★★★★★".slice(tm.rating)}</span>
                      </div>
                      <blockquote>{tm.quote}</blockquote>
                      {tm.name && <cite>— {tm.name}</cite>}
                    </TiltCard>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {t && (
          <section className="l-section">
            <div className="l-wrap">
              <Reveal>
                <div className="l-glass l-trainer">
                  <span className="l-trainer-photo">
                    {t.profile_photo_url ? (
                      <img src={t.profile_photo_url} alt="" />
                    ) : (
                      (t.name || "D").slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div>
                    <h2 className="l-h2" style={{ margin: 0 }}>{t.name}</h2>
                    {t.credentials && <p className="l-trainer-creds">{t.credentials}</p>}
                    {t.bio && <p>{t.bio}</p>}
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        )}

        {faq.length > 0 && (
          <section className="l-section">
            <div className="l-wrap l-wrap-narrow">
              <h2 className="l-h2">FAQ</h2>
              <div className="l-faq">
                {faq.map((f, i) => (
                  <details key={i} className="l-faq-item">
                    <summary>{f.question}</summary>
                    {f.answer && <p>{f.answer}</p>}
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {(c.contact_phone || c.instagram) && (
          <section className="l-section">
            <div className="l-wrap l-wrap-narrow">
              <div className="l-glass l-contact">
                <h2 className="l-h2" style={{ marginTop: 0 }}>Get in touch</h2>
                <div className="l-contact-links">
                  {c.contact_phone && (
                    <a
                      className="l-btn l-btn-ghost"
                      href={`tel:${c.contact_phone.replace(/\s+/g, "")}`}
                    >
                      {c.contact_phone}
                    </a>
                  )}
                  {c.instagram && (
                    <a
                      className="l-btn l-btn-ghost"
                      href={instaHref(c.instagram)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {instaLabel(c.instagram)}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="l-foot">
          <div className="l-wrap">Delt_era Fitness</div>
        </footer>

        <Link to={bookTo} className={`l-book ${showBook ? "is-in" : ""}`}>
          Book a session
        </Link>
    </div>
  );
}
