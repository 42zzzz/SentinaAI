import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Admin from "./pages/Admin";

import AppLayout from "./layouts/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import DevicesPage from "./pages/DevicesPage";
import EventsPage from "./pages/EventsPage";
import ExhibitorsPage from "./pages/ExhibitorsPage";
import BoothsPage from "./pages/BoothsPage";
import AlertsPage from "./pages/AlertsPage";
import NavigationPage from "./pages/NavigationPage";
import EventDetails from "./pages/EventDetails";
import ExhibitorDashboard from "./pages/ExhibitorDashboard";
import SustainabilityDashboard from "./pages/SustainabilityDashboard";
import AlertDetailsPage from "./pages/AlertDetailsPage";
import SustainabilityHallDetails from "./pages/SustainabilityHallDetails";

export default function App() {
  const role = localStorage.getItem("role");

  const redirectByRole = () => {
    switch (role) {
      case "super_admin":
        return "/admin";
      case "operations_manager":
        return "/operations";
      case "soc_analyst":
        return "/soc";
      case "sustainability_manager":
        return "/sustainability";
      case "exhibitor":
        return "/exhibitor";
      default:
        return "/";
    }
  };

  return (
    <BrowserRouter>
      <Routes>

        {/* LOGIN ROOT */}
        <Route
          path="/"
          element={
            role
              ? <Navigate to={redirectByRole()} replace />
              : <Login />
          }
        />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <Admin />
            </ProtectedRoute>
          }
        />

        {/* OPERATIONS */}
        <Route
          path="/operations/*"
          element={
            <ProtectedRoute allowedRoles={["operations_manager"]}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:id" element={<EventDetails />} />
          <Route path="exhibitors" element={<ExhibitorsPage />} />
          <Route path="booths" element={<BoothsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="navigation" element={<NavigationPage />} />
          <Route path="alerts/:id" element={<AlertDetailsPage />} />
        </Route>

        {/* FUTURE SOC */}
        <Route
          path="/soc/*"
          element={
            <ProtectedRoute allowedRoles={["soc_analyst"]}>
              <div>SOC Dashboard Coming Soon</div>
            </ProtectedRoute>
          }
        />

        {/* SUSTAINABILITY */}
        <Route
          path="/sustainability/*"
          element={
            <ProtectedRoute allowedRoles={["sustainability_manager"]}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<SustainabilityDashboard />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="alerts/:id" element={<AlertDetailsPage />} />
          <Route
            path="hall/:id"
            element={<SustainabilityHallDetails />}
          />

          {/* temporary placeholders */}
          <Route path="energy" element={<div>Energy Page</div>} />
          <Route path="environment" element={<div>Environmental Page</div>} />
          <Route path="map" element={<div>Map Page</div>} />
          <Route path="reports" element={<div>Reports Page</div>} />
        </Route>

        {/* EXHIBITOR */}
        <Route
          path="/exhibitor"
          element={
            <ProtectedRoute allowedRoles={["exhibitor"]}>
              <ExhibitorDashboard />
            </ProtectedRoute>
          }
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}