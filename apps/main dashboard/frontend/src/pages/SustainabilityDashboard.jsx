import "./SustainabilityDashboard.css";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import TrendPanel from "../components/TrendPanel";
import ComfortGauge from "../components/ComfortGauge";
import TopHallsEnergyBar from "../components/TopHallsEnergyBar";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

/* same icon wrapper used in operations */
const PinkIcon = ({ children }) => <div className="iconCircle">{children}</div>;

/* placeholder icons */
const EnergyIcon = () => <span>⚡</span>;
const CarbonIcon = () => <span>🌍</span>;
const EfficiencyIcon = () => <span>❄️</span>;
const AutomationIcon = () => <span>🤖</span>;

function KpiCard({ title, value, sub, icon }) {
  return (
    <div className="card">
      <div className="cardInner">
        <PinkIcon>{icon}</PinkIcon>
        <p className="cardTitle">{title}</p>
        <div className="cardValue">{value}</div>

        {sub ? (
          <div className="metricMetaRow">
            <p className="cardSub" style={{ margin: 0 }}>{sub}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CardShell({ title, right, icon, children }) {
  return (
    <div className="card">
      <div className="cardHeaderRow">
        <div className="cardHeaderLeft">
          {icon ? <div className="iconCircle iconCircleFloat">{icon}</div> : null}
          <h3>{title}</h3>
        </div>

        {right ? <span className="hint">{right}</span> : null}
      </div>

      <div className="cardBody">{children}</div>
    </div>
  );
}

export default function SustainabilityDashboard() {

  const [energyUsage, setEnergyUsage] = useState(null);
  const [carbonEmission, setCarbonEmission] = useState(null);
  const [hvacEfficiency, setHvacEfficiency] = useState(null);
  const [automationStatus, setAutomationStatus] = useState("Active");

  useEffect(() => {

    let alive = true;

    const load = async () => {
      try {

        /* placeholder using existing dashboard endpoint */
        const r = await axios.get(`${API_BASE}/dashboard/overview`);

        if (!alive) return;

        const k = r.data?.kpis;

        setEnergyUsage(k?.energyConsumption || 1450);
        setCarbonEmission(k?.carbonEmission || 520);
        setHvacEfficiency(k?.comfortIndex || 82);

      } catch {
        if (!alive) return;

        /* fallback fake values so UI always renders */
        setEnergyUsage(1450);
        setCarbonEmission(520);
        setHvacEfficiency(82);
      }
    };

    load();
    const t = setInterval(load, 15000);

    return () => {
      alive = false;
      clearInterval(t);
    };

  }, []);

  const energyValue = useMemo(() => {
    const n = Number(energyUsage);
    return Number.isFinite(n) ? `${Math.round(n)} kWh` : "—";
  }, [energyUsage]);

  const carbonValue = useMemo(() => {
    const n = Number(carbonEmission);
    return Number.isFinite(n) ? `${Math.round(n)} kg` : "—";
  }, [carbonEmission]);

  const hvacValue = useMemo(() => {
    const n = Number(hvacEfficiency);
    return Number.isFinite(n) ? `${Math.round(n)}%` : "—";
  }, [hvacEfficiency]);

  return (
    <div className="dashboardWrap sustTheme">
    <div className="dashboardWrap">

      {/* KPI ROW */}

      <div className="topRow">

        <KpiCard
          title="Current Energy Usage"
          value={energyValue}
          sub="Current interval"
          icon={<EnergyIcon />}
        />

        <KpiCard
          title="Carbon Emission Estimate"
          value={carbonValue}
          sub="Calculated footprint"
          icon={<CarbonIcon />}
        />

        <KpiCard
          title="HVAC Efficiency"
          value={hvacValue}
          sub="System performance"
          icon={<EfficiencyIcon />}
        />

        <KpiCard
          title="Automation Status"
          value={automationStatus}
          sub="Smart systems active"
          icon={<AutomationIcon />}
        />

      </div>


      {/* TREND CHARTS */}

      <div className="grid2">

        <CardShell title="Electricity Consumed" right="6h" icon={<EnergyIcon />}>
          <TrendPanel
            title={null}
            metric="energy"
            unit="kWh"
            hours={6}
            embedded
          />
        </CardShell>

        <CardShell title="Carbon Forecast Snapshot" right="6h" icon={<CarbonIcon />}>
          <TrendPanel
            title={null}
            metric="carbon"
            unit="kgCO2"
            hours={6}
            embedded
          />
        </CardShell>

      </div>


      {/* ENERGY ANALYTICS */}

      <div className="grid2">

        <CardShell title="Top Halls by Energy Use" icon={<EnergyIcon />}>
          <TopHallsEnergyBar
            title={null}
            limit={5}
            embedded
          />
        </CardShell>

        <CardShell title="Environment Health Score" icon={<CarbonIcon />}>
          <ComfortGauge
            title={null}
            value={hvacEfficiency}
            embedded
          />
        </CardShell>

      </div>

    </div>
  </div>
  );
}