import { useEffect } from "react";
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
