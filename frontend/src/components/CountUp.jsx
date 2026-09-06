import { useCountUp } from "../hooks.js";

// Landing-page only. Counts 0 → `to` when it scrolls into view
// (IntersectionObserver, see useCountUp). Reduced-motion jumps to the value.
export default function CountUp({ to, duration = 1200, suffix = "" }) {
  const [ref, value] = useCountUp(to, { duration });
  return (
    <span ref={ref} className="stat-number">
      {value}
      {suffix}
    </span>
  );
}
