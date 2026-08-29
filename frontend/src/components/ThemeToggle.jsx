import { useState } from "react";
import { applyTheme, getTheme, nextTheme } from "../theme.js";

const LABEL = { system: "◐ Auto", light: "☀ Light", dark: "☾ Dark" };

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme());
  return (
    <button
      className="theme-toggle"
      onClick={() => {
        const t = nextTheme(theme);
        applyTheme(t);
        setTheme(t);
      }}
      title="Switch theme (auto / light / dark)"
    >
      {LABEL[theme]}
    </button>
  );
}
