import { useEffect, useState } from "react";
import { api, getStoredUser, packageBannerText } from "../api";

// Non-blocking banner shown to a client on every page when their current
// package has 1 or 0 sessions remaining.
export default function PackageBanner() {
  const me = getStoredUser();
  const [text, setText] = useState("");

  useEffect(() => {
    if (!me || me.role !== "client") return;
    api.me()
      .then((u) => setText(packageBannerText(u.package)))
      .catch(() => {});
  }, [me?.id]);

  if (!text) return null;
  return <div className="banner">{text}</div>;
}
