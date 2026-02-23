import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";

import DashboardPage from "./pages/DashboardPage";
import DevicesPage from "./pages/DevicesPage";
import EventsPage from "./pages/EventsPage";
import ExhibitorsPage from "./pages/ExhibitorsPage";
import BoothsPage from "./pages/BoothsPage";
import AlertsPage from "./pages/AlertsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/exhibitors" element={<ExhibitorsPage />} />
          <Route path="/booths" element={<BoothsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />

          {/* Optional placeholders */}
          <Route path="/settings" element={<div>Settings (later)</div>} />
          <Route path="/help" element={<div>Help (later)</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}