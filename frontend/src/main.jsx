import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { getStoredUser, getToken } from "./api";
import { applyTheme, getTheme } from "./theme.js";
import "./styles.css";

import Landing from "./pages/Landing.jsx";
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
import Transformations from "./pages/Transformations.jsx";

applyTheme(getTheme());

function Require({ role, children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  const user = getStoredUser();
  if (role && user?.role !== role) {
    return <Navigate to={user?.role === "trainer" ? "/clients" : "/profile"} replace />;
  }
  return children;
}
const T = (el) => <Require role="trainer">{el}</Require>;
const C = (el) => <Require role="client">{el}</Require>;

function Root() {
  const user = getStoredUser();
  if (!user) return <Landing />;
  return <Navigate to={user.role === "trainer" ? "/clients" : "/profile"} replace />;
}

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: "/", element: <Root /> },
      { path: "/login", element: <Login /> },
      { path: "/signup", element: <Signup /> },

      { path: "/profile", element: C(<Profile />) },
      { path: "/workouts", element: C(<MySchedule />) },
      { path: "/meal-plan", element: C(<MyMealPlan />) },
      { path: "/supplements", element: C(<MySupplements />) },
      { path: "/progress", element: C(<MyProgress />) },
      { path: "/meal-check-in", element: C(<MyDietPhotos />) },
      { path: "/reports", element: C(<MyReports />) },

      { path: "/clients", element: T(<ClientList />) },
      { path: "/analytics", element: T(<Analytics />) },
      { path: "/announcements", element: T(<Announcements />) },
      { path: "/transformations", element: T(<Transformations />) },
      { path: "/clients/new", element: T(<ClientCreate />) },
      { path: "/clients/:id", element: T(<ClientDetail />) },
      { path: "/clients/:id/edit", element: T(<ClientEdit />) },
      { path: "/clients/:id/schedule", element: T(<ClientSchedule />) },
      { path: "/clients/:id/workouts", element: T(<ClientSessions />) },
      { path: "/clients/:id/meal-plan", element: T(<ClientMealPlan />) },
      { path: "/clients/:id/supplements", element: T(<ClientSupplements />) },
      { path: "/clients/:id/progress", element: T(<ClientProgress />) },
      { path: "/clients/:id/meal-check-in", element: T(<ClientDietPhotos />) },
      { path: "/clients/:id/reports", element: T(<ClientReports />) },
      { path: "/clients/:id/membership", element: T(<ClientPackage />) },
      { path: "/clients/:id/payments", element: T(<ClientPayments />) },
      { path: "/clients/:id/notes", element: T(<ClientNotes />) },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

// PWA: register the service worker in production builds only (keeps HMR clean in dev).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
