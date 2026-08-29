const KEY = "delt_era_theme";
export const THEMES = ["system", "light", "dark"];

export function getTheme() {
  return localStorage.getItem(KEY) || "system";
}

export function applyTheme(t) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
}

export function nextTheme(t) {
  return THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
}
