# EMQX MQTT Broker

EMQX 5.x broker with mTLS authentication and topic ACLs for SentinaAI IoT sensors.

## Distributing TLS Certificates

Certificates are generated locally via `scripts/gen_certs.sh` and must be distributed to devices manually — they are never committed to the repository.

| File | Safe to share? | Where it goes |
|------|---------------|---------------|
| `ca.crt` | Yes | Install on **every** device and service as the trust anchor |
| `<id>.crt` | Yes | Install on the **specific** device or service |
| `<id>.key` | **No** | Never share over email or Slack — copy via `scp`, a secrets manager (Vault, AWS Secrets Manager), or a USB drive |
