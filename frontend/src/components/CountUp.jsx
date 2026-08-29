import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Landing-page only: counts up from 0 to `to` when scrolled into view.
// `delay` staggers multiple counters; `suffix` appends e.g. "+".
export default function CountUp({ to, duration = 1.1, delay = 0, suffix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, duration, delay]);

  return (
    <span ref={ref} className="stat-number">
      {val}
      {suffix}
    </span>
  );
}
