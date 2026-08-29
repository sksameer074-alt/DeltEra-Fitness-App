import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, getStoredUser } from "./api";
import Layout from "./components/Layout.jsx";
import PackageBanner from "./components/PackageBanner.jsx";

export default function App() {
  const navigate = useNavigate();
  const user = getStoredUser();

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <Layout>
      <div className="container">
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
