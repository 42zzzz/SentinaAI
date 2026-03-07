import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import "./AlertDetailsPage.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const role = localStorage.getItem("role");

const roleDomainMap = {
    operations_manager: "OPERATIONS",
    sustainability_manager: "SUSTAINABILITY",
    soc_analyst: "SOC",
    exhibitor: "EXHIBITOR",
};

const domain = roleDomainMap[role];

export default function AlertDetailsPage() {

    const { id } = useParams();
    const navigate = useNavigate();

    const [alert, setAlert] = useState(null);
    const [actions, setActions] = useState([]);
    const [selectedActions, setSelectedActions] = useState({});

    const resolved =
        alert?.status === "RESOLVED" ||
        alert?.status === "CLOSED";

    useEffect(() => {

        const load = async () => {

            const res = await axios.get(`${API_BASE}/alerts/${id}`, {
                params: { domain }
            });

            const data = res.data;
            setAlert(data.alert);
            // mark already executed actions
            if (data.alert?.action_taken) {

                const executed = data.alert.action_taken
                    .split(",")
                    .map(a => a.trim());

                const initial = {};

                executed.forEach(a => {
                    const key = a.toLowerCase().replace(/\s+/g, "_");
                    initial[key] = true;
                });

                setSelectedActions(initial);
            }

            // Prefer multi-actions if backend sends them
            if (data.actions && Array.isArray(data.actions) && data.actions.length) {
                setActions(data.actions);
                return;
            }

            // Otherwise build one action from alert fields
            const a = data.alert || {};

            const actionText =
                a.recommended_action ||
                a.default_response_action ||
                "Investigate alert";

            const severity = String(a.severity || "MEDIUM").toLowerCase();

            const isAutomated =
                String(a.default_response_type || "").toUpperCase() === "AUTOMATED" ||
                a.auto_mitigation_enabled === true;

            setActions([
                {
                    action_key: "default_action",
                    action_name: actionText,
                    impact: severity,
                    automated: isAutomated
                }
            ]);

        };

        load();

    }, [id]);

    const toggleAction = (key) => {

        if (resolved) return;

        setSelectedActions(prev => ({
            ...prev,
            [key]: !prev[key]
        }));

    };

    const triggerActions = async () => {

        const chosen = Object.keys(selectedActions)
            .filter(k => selectedActions[k]);

        if (chosen.length === 0) return;

        await axios.post(`${API_BASE}/alerts/${id}/execute`, {
            actions: chosen,
            user_id: localStorage.getItem("user_id")
        });

        window.location.reload();

    };

    if (!alert) {
        return <div className="alertDetailsLoading">Loading...</div>;
    }

    return (
        <div className="opsTheme alertDetailsPage">

            <div className="alertHeader">

                <button
                    className="alertBack"
                    onClick={() => navigate(-1)}
                >
                    ←
                </button>

                <div className="alertHeaderTitleWrap">
                    <div className="alertHeaderTitle">
                        Alert Overview | {new Date(alert.detected_at).toLocaleString()}
                    </div>

                    <span className={`statusPill ${String(alert.status || "").toLowerCase()}`}>
                        {alert.status}
                    </span>
                </div>

            </div>


            {/* KPI ROW */}

            <div className="alertMetricsRow">

                <div className="metricCard aiMetric">
                    <div className="metricTitle">AI Confidence</div>
                    <div className="metricValue">
                        {Math.round((alert.ai_confidence || 0.94) * 100)}%
                    </div>
                </div>

                <div className="metricCard">
                    <div className="metricTitle">Threshold</div>
                    <div className="metricValue">{alert.threshold_value || "-"}</div>
                </div>

                <div className="metricCard red">
                    <div className="metricTitle">Current Occupancy</div>
                    <div className="metricValue">{alert.trigger_value || "-"}</div>
                </div>

            </div>


            {/* MAIN BODY */}

            <div className="alertBody">

                {/* LEFT PANEL */}

                <div className="alertInfoCard">

                    <h2>Alert Overview</h2>

                    <div className="alertGrid">

                        <div>
                            <label>Alert ID</label>
                            <div>{alert.alert_id}</div>
                        </div>

                        <div>
                            <label>Root Cause</label>
                            <div>{alert.rule_name}</div>
                        </div>

                        <div>
                            <label>Priority</label>
                            <div className={`priorityBadge ${(alert.severity || "").toLowerCase()}`}>
                                {alert.severity}
                            </div>
                        </div>

                        <div>
                            <label>Zone</label>
                            <div>{alert.zone_id}</div>
                        </div>

                        <div>
                            <label>Time</label>
                            <div>
                                {new Date(alert.detected_at).toLocaleString()}
                            </div>
                        </div>

                        <div>
                            <label>Description</label>
                            <div>
                                {alert.message || "No description available"}
                            </div>
                        </div>

                        <div>
                            <label>Source</label>
                            <div>{alert.source || "Sensor"}</div>
                        </div>

                    </div>

                </div>


                {/* RIGHT PANEL */}

                <div className="alertActionsCard">

                    <h3>Recommended Actions</h3>

                    <table className="actionsTable">

                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Execute</th>
                            </tr>
                        </thead>

                        <tbody>

                            {actions.map(a => {

                                const active = selectedActions[a.action_key];

                                return (
                                    <tr key={a.action_key}>

                                        <td>{a.action_name}</td>

                                        <td>
                                            <label className="switch">

                                                <input
                                                    type="checkbox"
                                                    checked={a.automated || active || false}
                                                    disabled={resolved || a.automated}
                                                    onChange={() => toggleAction(a.action_key)}
                                                />

                                                <span className="slider"></span>

                                            </label>
                                        </td>

                                    </tr>
                                );

                            })}

                        </tbody>

                    </table>

                </div>

            </div>


            {/* FOOTER */}

            <div className="alertFooter">

                <button
                    className="cancelBtn"
                    onClick={() => navigate(-1)}
                >
                    Cancel
                </button>

                <button
                    className="triggerBtn"
                    disabled={resolved}
                    onClick={triggerActions}
                >
                    Trigger Automated Response
                </button>

            </div>

        </div>
    );

}