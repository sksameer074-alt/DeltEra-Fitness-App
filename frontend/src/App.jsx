import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getStoredUser } from "./api";
import Layout from "./components/Layout.jsx";
import PackageBanner from "./components/PackageBanner.jsx";

// Content-column width per page type.
//   wide (~1340px): data-heavy pages — lists, tables, calendars, analytics
//   narrow (~760px): single-column forms
//   default (~1000px): everything else
const WIDE = [
  /^\/clients$/,
  /^\/analytics$/,
  /^\/announcements$/,
  /^\/transformations$/,
  /^\/clients\/[^/]+$/, // client detail
  /^\/clients\/[^/]+\/(workouts|progress|schedule|meal-check-in|payments)$/,
  /^\/(workouts|progress|meal-check-in)$/,
];
const NARROW = [
  /^\/(login|signup|profile)$/,
  /^\/clients\/new$/,
  /^\/clients\/[^/]+\/edit$/,
  /^\/(meal-plan|supplements|reports)$/,
  /^\/clients\/[^/]+\/(meal-plan|supplements|notes|membership|reports)$/,
];

function widthClass(pathname) {
  if (pathname === "/") return ""; // landing manages its own full-bleed layout
  if (NARROW.some((re) => re.test(pathname))) return " is-narrow";
  if (WIDE.some((re) => re.test(pathname))) return " is-wide";
  return "";
}

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = getStoredUser();

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <Layout>
      <div className={"container" + widthClass(pathname)}>
        {user && (
          <nav>
            {user.role === "trainer" && <NavLink to="/clients">Clients</NavLink>}
            {user.role === "trainer" && <NavLink to="/analytics">Analytics</NavLink>}
            {user.role === "trainer" && <NavLink to="/announcements">Announcements</NavLink>}
            {user.role === "trainer" && <NavLink to="/transformations">Transformations</NavLink>}
            {user.role === "client" && <NavLink to="/profile">Profile</NavLink>}
            {user.role === "client" && <NavLink to="/workouts">Workouts</NavLink>}
            {user.role === "client" && <NavLink to="/meal-plan">Meal plan</NavLink>}
            {user.role === "client" && <NavLink to="/supplements">Supplements</NavLink>}
            {user.role === "client" && <NavLink to="/progress">Progress</NavLink>}
            {user.role === "client" && <NavLink to="/meal-check-in">Meal check-in</NavLink>}
            {user.role === "client" && <NavLink to="/reports">Reports</NavLink>}
            <span style={{ flex: 1 }} />
            <button className="link" onClick={logout}>Log out ({user.name})</button>
          </nav>
        )}

        {user?.role === "client" && <PackageBanner />}

        <Outlet />
      </div>
    </Layout>
  );
}
