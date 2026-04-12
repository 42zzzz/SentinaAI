  async function getEnabledSecurityRules() {
    const enabledColumnCheck = await coreDb.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'rules'
        AND column_name = 'enabled'
      LIMIT 1
      `
    );

    const hasEnabled = (enabledColumnCheck.rows || []).length > 0;

    const sql = hasEnabled
      ? `
        SELECT
          rule_key,
          domain,
          rule_name,
          description,
          event_type,
          field_path,
          aggregation,
          window_seconds,
          operator,
          threshold_value,
          base_severity,
          escalation_enabled,
          escalation_window_seconds,
          escalation_threshold,
          cooldown_seconds,
          default_response_type,
          default_response_action,
          auto_mitigation_enabled,
          recommended_actions
        FROM rules
        WHERE enabled = TRUE
          AND domain = 'SECURITY'
        ORDER BY rule_key ASC
        `
      : `
        SELECT
          rule_key,
          domain,
          rule_name,
          description,
          event_type,
          field_path,
          aggregation,
          window_seconds,
          operator,
          threshold_value,
          base_severity,
          escalation_enabled,
          escalation_window_seconds,
          escalation_threshold,
          cooldown_seconds,
          default_response_type,
          default_response_action,
          auto_mitigation_enabled,
          recommended_actions
        FROM rules
        WHERE domain = 'SECURITY'
        ORDER BY rule_key ASC
        `;

    const result = await coreDb.query(sql);
    return result.rows || [];
  }