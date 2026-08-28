import { Navigate, Link, Route, Routes, useNavigate } from "react-router-dom";
import { clearSession, getStoredUser, getToken } from "./api";
import PackageBanner from "./components/PackageBanner.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Profile from "./pages/Profile.jsx";
import MySchedule from "./pages/MySchedule.jsx";
import MyMealPlan from "./pages/MyMealPlan.jsx";
import MySupplements from "./pages/MySupplements.jsx";
import MyProgress from "./pages/MyProgress.jsx";
import MyDietPhotos from "./pages/MyDietPhotos.jsx";
import MyReports from "./pages/MyReports.jsx";
import ClientList from "./pages/ClientList.jsx";
import ClientCreate from "./pages/ClientCreate.jsx";
import ClientDetail from "./pages/ClientDetail.jsx";
import ClientEdit from "./pages/ClientEdit.jsx";
import ClientSchedule from "./pages/ClientSchedule.jsx";
import ClientSessions from "./pages/ClientSessions.jsx";
import ClientMealPlan from "./pages/ClientMealPlan.jsx";
import ClientSupplements from "./pages/ClientSupplements.jsx";
import ClientNotes from "./pages/ClientNotes.jsx";
import ClientProgress from "./pages/ClientProgress.jsx";
import ClientDietPhotos from "./pages/ClientDietPhotos.jsx";
import ClientReports from "./pages/ClientReports.jsx";
import ClientPackage from "./pages/ClientPackage.jsx";
import ClientPayments from "./pages/ClientPayments.jsx";
import Analytics from "./pages/Analytics.jsx";
import Announcements from "./pages/Announcements.jsx";

function RequireAuth({ children, role }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  const user = getStoredUser();
  if (role && user?.role !== role) {
    return <Navigate to={user?.role === "trainer" ? "/clients" : "/profile"} replace />;
  }
  return children;
}

function Home() {
  const user = getStoredUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "trainer" ? "/clients" : "/profile"} replace />;
}

const T = (el) => <RequireAuth role="trainer">{el}</RequireAuth>;
const C = (el) => <RequireAuth role="client">{el}</RequireAuth>;

export default function App() {
  const navigate = useNavigate();
  const user = getStoredUser();

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="container">
      <nav>
        <strong>Delt_era Fitness</strong>
        {user?.role === "trainer" && <Link to="/clients">Clients</Link>}
        {user?.role === "trainer" && <Link to="/analytics">Analytics</Link>}
        {user?.role === "trainer" && <Link to="/announcements">Announce</Link>}
        {user?.role === "client" && <Link to="/profile">Profile</Link>}
        {user?.role === "client" && <Link to="/workouts">Workouts</Link>}
        {user?.role === "client" && <Link to="/meal-plan">Meal plan</Link>}
        {user?.role === "client" && <Link to="/supplements">Supplements</Link>}
        {user?.role === "client" && <Link to="/progress">Progress</Link>}
        {user?.role === "client" && <Link to="/daily-check-in">Daily Check-in</Link>}
        {user?.role === "client" && <Link to="/reports">Reports</Link>}
        <span style={{ flex: 1 }} />
        {user && (
          <button className="link" onClick={logout}>
            Log out ({user.name})
          </button>
        )}
      </nav>

      {user?.role === "client" && <PackageBanner />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/profile" element={C(<Profile />)} />
        <Route path="/workouts" element={C(<MySchedule />)} />
        <Route path="/meal-plan" element={C(<MyMealPlan />)} />
        <Route path="/supplements" element={C(<MySupplements />)} />
        <Route path="/progress" element={C(<MyProgress />)} />
        <Route path="/daily-check-in" element={C(<MyDietPhotos />)} />
        <Route path="/reports" element={C(<MyReports />)} />

        <Route path="/clients" element={T(<ClientList />)} />
        <Route path="/analytics" element={T(<Analytics />)} />
        <Route path="/announcements" element={T(<Announcements />)} />
        <Route path="/clients/new" element={T(<ClientCreate />)} />
        <Route path="/clients/:id" element={T(<ClientDetail />)} />
        <Route path="/clients/:id/edit" element={T(<ClientEdit />)} />
        <Route path="/clients/:id/schedule" element={T(<ClientSchedule />)} />
        <Route path="/clients/:id/workouts" element={T(<ClientSessions />)} />
        <Route path="/clients/:id/meal-plan" element={T(<ClientMealPlan />)} />
        <Route path="/clients/:id/supplements" element={T(<ClientSupplements />)} />
        <Route path="/clients/:id/progress" element={T(<ClientProgress />)} />
        <Route path="/clients/:id/daily-check-in" element={T(<ClientDietPhotos />)} />
        <Route path="/clients/:id/reports" element={T(<ClientReports />)} />
        <Route path="/clients/:id/membership" element={T(<ClientPackage />)} />
        <Route path="/clients/:id/payments" element={T(<ClientPayments />)} />
        <Route path="/clients/:id/notes" element={T(<ClientNotes />)} />
      </Routes>
    </div>
  );
}
