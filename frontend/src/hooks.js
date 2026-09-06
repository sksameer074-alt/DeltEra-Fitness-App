import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";

const MESSAGE = "You have unsaved changes — leave anyway?";

/**
 * Warn before leaving a page (in-app navigation or tab close/refresh)
 * while `dirty` is true.
 */
export function useUnsavedGuard(dirty) {
  // in-app navigation (React Router)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm(MESSAGE)) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);

  // browser close / refresh / external nav
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/** Track a CSS media query. SSR-safe-ish; defaults to `false`. */
export function useMediaQuery(query) {
  const get = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** True when the user has asked for reduced motion. */
export function usePrefersReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/**
 * Fire once when the returned ref first scrolls into view. Degrades safely:
 * if IntersectionObserver is missing, or nothing fires within `fallbackMs`,
 * it reports `true` anyway so content is never left hidden.
 * Returns `[ref, inView]`.
 */
export function useInViewOnce({ rootMargin = "0px 0px -8% 0px", fallbackMs = 1400 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    io.observe(el);
    const t = setTimeout(() => {
      setInView(true);
      io.disconnect();
    }, fallbackMs);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, [rootMargin, fallbackMs]);

  return [ref, inView];
}

/**
 * Count from 0 → `target` once the returned ref scrolls into view, using an
 * IntersectionObserver + rAF easing. Honours reduced-motion (jumps to the
 * final value). Returns `[ref, value]`.
 */
export function useCountUp(target, { duration = 1200 } = {}) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    const end = Number(target) || 0;
    if (!el) return;
    if (reduce || end === 0) {
      setValue(end);
      return;
    }

    let raf = 0;
    let startTs = 0;
    const step = (ts) => {
      if (!startTs) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(end * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    io.observe(el);

    // Safety: if the observer never fires (broken IO, print, etc.) don't leave
    // the number stuck at 0 — snap to the final value.
    const fallback = setTimeout(() => {
      io.disconnect();
      setValue(end);
    }, 2500);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [target, duration, reduce]);

  return [ref, value];
}
