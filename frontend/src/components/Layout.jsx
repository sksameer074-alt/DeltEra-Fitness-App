import { Link } from "react-router-dom";
import { getStoredUser } from "../api";
import ThemeToggle from "./ThemeToggle.jsx";

function HeaderAvatar() {
  const user = getStoredUser();
  if (!user) {
    return (
      <span className="header-auth">
        <Link to="/login" className="btn btn-secondary">Log in</Link>
        <Link to="/signup" className="btn btn-primary">Sign up</Link>
      </span>
    );
  }
  return (
    <Link to="/" className="avatar" title={user.name}>
      {user.profile_photo_url
        ? <img src={user.profile_photo_url} alt="" />
        : (user.name || "?").slice(0, 1).toUpperCase()}
    </Link>
  );
}

export default function Layout({ children }) {
  return (
    <>
      <div className="watermark" aria-hidden="true"><span>DELT_ERA</span></div>

      <header className="app-header">
        <Link to="/" className="brand">
          <span className="logo">D</span>
          Delt_era Fitness
        </Link>
        <span className="spacer" />
        <ThemeToggle />
        <HeaderAvatar />
      </header>

      {children}
    </>
  );
}
