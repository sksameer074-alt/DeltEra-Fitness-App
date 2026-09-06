import { useRef } from "react";
import { usePrefersReducedMotion, useMediaQuery } from "../hooks.js";

/**
 * Wrapper that tilts on mouse position (perspective + rotateX/rotateY).
 * Disabled for touch pointers and when prefers-reduced-motion is set —
 * it then renders a plain static container.
 */
export default function TiltCard({ className = "", children, max = 7, ...rest }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const finePointer = useMediaQuery("(pointer: fine)");
  const active = finePointer && !reduce;

  function onMove(e) {
    const el = ref.current;
    if (!el || !active) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * max).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * max).toFixed(2)}deg`);
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={ref}
      className={`tilt ${active ? "tilt-active" : ""} ${className}`.trim()}
      onMouseMove={onMove}
      onMouseLeave={reset}
      {...rest}
    >
      {children}
    </div>
  );
}
