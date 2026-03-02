# Security hardening (NFR-24 .. NFR-29)

This folder contains **drop-in configs** to satisfy the system-wide security NFRs:

## NFR-24 — Anonymize people counting data (no facial / personal IDs stored)

- Telemetry ingest (`services/telemetry-service/mqtt_ingest.py`) uses an allow-list
  sanitizer (`shared/telemetry/sanitize.py`).
- Any record containing keys that look like faces/tracks/embeddings/frames is **dropped**.
- `deviceId` is replaced with a deterministic HMAC hash (`deviceHash`).

## NFR-25 — Data minimization

- Only `zoneId`, `hallId`, `timestamp`, `readingType`, and a **small allow-list** of
  `values` per readingType are persisted.
- `readingId` is dropped by default.

## NFR-26 — Authenticate all IoT devices communicating with the MQTT broker

- Mosquitto config sets `allow_anonymous false`.
- Recommended: **mutual TLS** (`require_certificate true`) so each device authenticates
  via a client certificate.

## NFR-27 — Restrict unauthorized publishing/subscribing to MQTT topics

- `aclfile` uses per-user topic patterns so each device can only publish to its own
  telemetry topic and only subscribe to its own command/config topics.

## NFR-28 — TLS for MQTT broker and Node-RED

- Mosquitto exposes secure listener `8883` with server certs.
- Node-RED is configured to serve its UI over HTTPS and to connect to MQTT over TLS.

## NFR-29 — Least privilege network access

- `docker-compose.security.yml` uses **internal** docker networks and only exposes
  required ports to the host.
- In real deployment, apply the same principle at the venue network level
  (VLANs / SSIDs per device class, firewall rules so IoT devices can only reach the broker).

---

## Quick demo (Docker)

1) Generate certs (self-signed for local dev):

```bash
bash services/security/scripts/generate_certs.sh
```

2) Create Mosquitto passwords (optional if using mTLS usernames):

```bash
# requires mosquitto_passwd installed on your machine
bash services/security/scripts/create_passwords.sh
```

3) Start the secure stack:

```bash
docker compose -f docker-compose.security.yml up
```

> For production: replace the self-signed certs with proper CA-issued certificates.


---

## Using EMQX instead of Mosquitto

If you prefer EMQX, a drop-in secure docker compose is provided:

```bash
bash services/security/scripts/generate_certs.sh
TELEMETRY_HMAC_KEY=change-me docker compose -f docker-compose.security.emqx.yml up
```

EMQX config files:
- `services/security/emqx-broker/emqx.conf`
- `services/security/emqx-broker/acl.conf`

