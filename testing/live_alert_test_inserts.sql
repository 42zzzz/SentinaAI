-- Run these against sentina_core.
-- Open the matching dashboard first, then execute one INSERT at a time.
-- These use real rule keys from the rules table and.
-- A hidden metadata tag is included for clean up later.

-- =========================================================
-- OPERATIONS | MEDIUM | HALL NEARING CAPACITY
-- =========================================================
INSERT INTO alerts (
  rule_key, domain, severity, status, device_id, zone_id, hall_id,
  event_timestamp, detected_at, trigger_value, threshold_value,
  message, escalation_level, metadata, recommended_action,
  action_status, auto_response_executed, response_type, response_action
)
SELECT
  r.rule_key,
  r.domain,
  'MEDIUM',
  'NEW',
  'CAM-OPS-014',
  'ZONE_A',
  'HALL_A',
  NOW(),
  NOW(),
  0.74,
  r.threshold_value,
  'Occupancy in Hall A is approaching the operational threshold. Floor staff should monitor crowd buildup and prepare redirection measures if inflow continues.',
  0,
  jsonb_build_object(
    'script_tag', 'live_alert_realistic',
    'dashboard', 'operations',
    'sensor_type', 'occupancy',
    'observed_metric', 'occupancyRatio',
    'rule_name', r.rule_name,
    'inserted_at', NOW()
  ),
  r.default_response_action,
  'PENDING',
  FALSE,
  r.default_response_type,
  r.default_response_action
FROM rules r
WHERE r.rule_key = 'OPS_CROWD_WARNING'
RETURNING alert_id, rule_key, domain, severity, status, detected_at;


-- =========================================================
-- OPERATIONS | HIGH | UNSAFE OCCUPANCY LEVEL
-- =========================================================
INSERT INTO alerts (
  rule_key, domain, severity, status, device_id, zone_id, hall_id,
  event_timestamp, detected_at, trigger_value, threshold_value,
  message, escalation_level, metadata, recommended_action,
  action_status, auto_response_executed, response_type, response_action
)
SELECT
  r.rule_key,
  r.domain,
  'HIGH',
  'NEW',
  'CAM-OPS-021',
  'ZONE_A',
  'HALL_A',
  NOW(),
  NOW(),
  0.82,
  r.threshold_value,
  'Hall A has exceeded the safe occupancy threshold. Entry should be restricted temporarily while security and floor staff stabilize crowd flow.',
  1,
  jsonb_build_object(
    'script_tag', 'live_alert_realistic',
    'dashboard', 'operations',
    'sensor_type', 'occupancy',
    'observed_metric', 'occupancyRatio',
    'rule_name', r.rule_name,
    'inserted_at', NOW()
  ),
  r.default_response_action,
  'PENDING',
  FALSE,
  r.default_response_type,
  r.default_response_action
FROM rules r
WHERE r.rule_key = 'OPS_CROWD_CRITICAL'
RETURNING alert_id, rule_key, domain, severity, status, detected_at;


-- =========================================================
-- SUSTAINABILITY | MEDIUM | EFFICIENCY DROP
-- =========================================================
INSERT INTO alerts (
  rule_key, domain, severity, status, device_id, zone_id, hall_id,
  event_timestamp, detected_at, trigger_value, threshold_value,
  message, escalation_level, metadata, recommended_action,
  action_status, auto_response_executed, response_type, response_action
)
SELECT
  r.rule_key,
  r.domain,
  'MEDIUM',
  'NEW',
  'HVAC-SUS-008',
  'ZONE_B',
  'HALL_B',
  NOW(),
  NOW(),
  59.0,
  r.threshold_value,
  'Energy efficiency in Hall B has dropped below the expected operating range. Review HVAC performance and verify whether current load conditions justify the increase in consumption.',
  0,
  jsonb_build_object(
    'script_tag', 'live_alert_realistic',
    'dashboard', 'sustainability',
    'sensor_type', 'hvac_energy',
    'observed_metric', 'efficiencyScore',
    'rule_name', r.rule_name,
    'inserted_at', NOW()
  ),
  r.default_response_action,
  'PENDING',
  FALSE,
  r.default_response_type,
  r.default_response_action
FROM rules r
WHERE r.rule_key = 'SUS_LOW_EFFICIENCY'
RETURNING alert_id, rule_key, domain, severity, status, detected_at;


-- =========================================================
-- SUSTAINABILITY | HIGH | REPEATED ENERGY EVENTS
-- =========================================================
INSERT INTO alerts (
  rule_key, domain, severity, status, device_id, zone_id, hall_id,
  event_timestamp, detected_at, trigger_value, threshold_value,
  message, escalation_level, metadata, recommended_action,
  action_status, auto_response_executed, response_type, response_action
)
SELECT
  r.rule_key,
  r.domain,
  'HIGH',
  'NEW',
  'HVAC-SUS-012',
  'ZONE_B',
  'HALL_B',
  NOW(),
  NOW(),
  4.0,
  r.threshold_value,
  'Multiple sustainability-related alerts have been raised for Hall B within the current monitoring window. The pattern suggests a recurring efficiency issue that requires supervisor review.',
  1,
  jsonb_build_object(
    'script_tag', 'live_alert_realistic',
    'dashboard', 'sustainability',
    'sensor_type', 'internal',
    'observed_metric', 'sustainability_alert_count',
    'rule_name', r.rule_name,
    'inserted_at', NOW()
  ),
  r.default_response_action,
  'PENDING',
  FALSE,
  r.default_response_type,
  r.default_response_action
FROM rules r
WHERE r.rule_key = 'SUS_ESCALATION_001'
RETURNING alert_id, rule_key, domain, severity, status, detected_at;


-- =========================================================
-- SECURITY | MEDIUM | TELEMETRY FLOOD
-- =========================================================
INSERT INTO alerts (
  rule_key, domain, severity, status, device_id, zone_id, hall_id,
  event_timestamp, detected_at, trigger_value, threshold_value,
  message, escalation_level, metadata, recommended_action,
  action_status, auto_response_executed, response_type, response_action
)
SELECT
  r.rule_key,
  r.domain,
  'MEDIUM',
  'NEW',
  'MQ-003',
  'ZONE_C',
  'HALL_C',
  NOW(),
  NOW(),
  327.0,
  r.threshold_value,
  'Device MQ-003 is generating telemetry at an abnormally high rate. The broker should be reviewed for rate abuse or a misconfigured publisher.',
  0,
  jsonb_build_object(
    'script_tag', 'live_alert_realistic',
    'dashboard', 'soc',
    'sensor_type', 'broker',
    'observed_metric', 'device_message_count',
    'rule_name', r.rule_name,
    'inserted_at', NOW()
  ),
  r.default_response_action,
  'PENDING',
  FALSE,
  r.default_response_type,
  r.default_response_action
FROM rules r
WHERE r.rule_key = 'SEC_FLOOD_001'
RETURNING alert_id, rule_key, domain, severity, status, detected_at;


-- =========================================================
-- SECURITY | HIGH | BRUTE FORCE LOGIN BURST
-- =========================================================
INSERT INTO alerts (
  rule_key, domain, severity, status, device_id, zone_id, hall_id,
  event_timestamp, detected_at, trigger_value, threshold_value,
  message, escalation_level, metadata, recommended_action,
  action_status, auto_response_executed, response_type, response_action
)
SELECT
  r.rule_key,
  r.domain,
  'HIGH',
  'NEW',
  'AUTH-GW-002',
  'ZONE_C',
  'HALL_C',
  NOW(),
  NOW(),
  9.0,
  r.threshold_value,
  'Repeated failed authentication attempts were detected against gateway AUTH-GW-002 from the same source range. Access controls should be reviewed and the source investigated for brute-force behavior.',
  1,
  jsonb_build_object(
    'script_tag', 'live_alert_realistic',
    'dashboard', 'soc',
    'sensor_type', 'auth',
    'observed_metric', 'failed_login_burst',
    'rule_name', r.rule_name,
    'inserted_at', NOW()
  ),
  r.default_response_action,
  'PENDING',
  FALSE,
  r.default_response_type,
  r.default_response_action
FROM rules r
WHERE r.rule_key = 'SEC_AUTH_BRUTE_001'
RETURNING alert_id, rule_key, domain, severity, status, detected_at;


-- =========================================================
-- SECURITY | CRITICAL | TELEMETRY INTEGRITY MANIPULATION
-- =========================================================
INSERT INTO alerts (
  rule_key, domain, severity, status, device_id, zone_id, hall_id,
  event_timestamp, detected_at, trigger_value, threshold_value,
  message, escalation_level, metadata, recommended_action,
  action_status, auto_response_executed, response_type, response_action
)
SELECT
  r.rule_key,
  r.domain,
  'CRITICAL',
  'NEW',
  'MQ-003',
  'ZONE_C',
  'HALL_C',
  NOW(),
  NOW(),
  5.0,
  r.threshold_value,
  'Telemetry integrity validation failed for device MQ-003. Observed readings are inconsistent with the expected profile and may indicate manipulated or injected data.',
  2,
  jsonb_build_object(
    'script_tag', 'live_alert_realistic',
    'dashboard', 'soc',
    'sensor_type', 'integrity',
    'observed_metric', 'telemetry_integrity_violation',
    'rule_name', r.rule_name,
    'inserted_at', NOW()
  ),
  r.default_response_action,
  'PENDING',
  FALSE,
  r.default_response_type,
  r.default_response_action
FROM rules r
WHERE r.rule_key = 'SEC_INTEGRITY_001'
RETURNING alert_id, rule_key, domain, severity, status, detected_at;


-- =========================================================
-- CLEANUP
-- =========================================================
DELETE FROM alerts
WHERE metadata ->> 'script_tag' = 'live_alert_realistic'
RETURNING alert_id, rule_key, domain, severity, status;
