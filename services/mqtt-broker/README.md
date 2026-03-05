# EMQX MQTT Broker

EMQX 5.8 broker with mTLS authentication and per-device topic ACLs for SentinaAI IoT sensors.

**Security model:**
- Every client must present a TLS certificate signed by the project CA (NFR-26)
- The certificate CN becomes the client's MQTT username, used in ACL rules (NFR-27)
- Only port 8883 (TLS) is exposed — plain-text ports 1883 and 8083 are disabled (NFR-28)

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose)
- Bash (WSL on Windows, or macOS/Linux terminal)
- Python 3.9+ with `paho-mqtt` (`pip install paho-mqtt`)

---

## Setup

### 1. Generate TLS certificates

Run from the `services/mqtt-broker/` directory in a **Bash** shell (WSL on Windows):

```bash
bash scripts/gen_certs.sh --server
bash scripts/gen_certs.sh --client sensor-HZA01-occ
bash scripts/gen_certs.sh --client edge-node
bash scripts/gen_certs.sh --client sentina-backend
```

This creates `certs/` with:
- `ca.crt` / `ca.key` — the project Certificate Authority
- `server.crt` / `server.key` — the broker's TLS certificate
- `<id>.crt` / `<id>.key` — a client certificate per identity

> Certificates are git-ignored and must never be committed.

### 2. Start the broker

```bash
docker compose up -d
```

Wait ~15 seconds for EMQX to finish initialising, then verify it's healthy:

```bash
docker exec sentina-emqx emqx ping   # should print: pong
```

### 3. Run integration tests

```bash
python scripts/test_emqx.py -v
```

All 9 tests should pass:

```
NFR-28 T1 — Port 1883 is closed (plain-text disabled)     PASS
NFR-26 T2 — Anonymous TLS connection is rejected           PASS
NFR-26 T3 — Device with valid cert connects                PASS
NFR-27 T4 — Device publishes to own topic (allowed)        PASS
NFR-27 T5 — Device publish to other device's topic denied  PASS
NFR-27 T6 — Device subscribe to all-devices wildcard denied PASS
NFR-27 T7 — Device subscribe to aggregated/# denied        PASS
NFR-27 T8 — Edge-node subscribes to all device topics      PASS
NFR-27 T9 — Edge-node publishes aggregated metrics         PASS
```

### 4. Change the dashboard password

Open [http://localhost:18083](http://localhost:18083) and log in with `admin` / `SentinaAdmin_CHANGEME!`.
Change the password immediately on first login.

> In production, also update `EMQX_NODE__COOKIE` and `EMQX_DASHBOARD__DEFAULT_PASSWORD` in `docker-compose.yml` and restrict the dashboard port to loopback (`127.0.0.1:18083:18083`).

---

## Adding a new device

```bash
# 1. Generate a client certificate — the CN becomes the device's MQTT username
bash scripts/gen_certs.sh --client sensor-HZB03-temp

# 2. Copy files to the device
scp certs/ca.crt          user@device:/etc/sentina/
scp certs/sensor-HZB03-temp.crt  user@device:/etc/sentina/
scp certs/sensor-HZB03-temp.key  user@device:/etc/sentina/   # use scp or a secrets manager
```

The device's certificate CN (`sensor-HZB03-temp`) is automatically used as its MQTT username.
ACL rules already allow any `sensor-*` client to publish to `sentina/devices/<its-own-CN>/#` — no ACL changes needed for new devices.

---

## Distributing TLS Certificates

| File | Safe to share? | Where it goes |
|------|---------------|---------------|
| `ca.crt` | Yes | Install on **every** device and service as the trust anchor |
| `<id>.crt` | Yes | Install on the **specific** device or service |
| `<id>.key` | **No** | Never share over email or Slack — copy via `scp`, a secrets manager (Vault, AWS Secrets Manager), or a USB drive |

---

## Topic namespace

| Topic pattern | Who publishes | Who subscribes |
|---------------|--------------|----------------|
| `sentina/devices/<device-CN>/<reading>` | That device only | `edge-node` |
| `sentina/commands/<device-CN>/<cmd>` | `edge-node`, `sentina-backend` | That device only |
| `sentina/aggregated/<hall-id>/<metric>` | `edge-node` | `sentina-backend` |
| `sentina/alerts/<hall-id>` | `edge-node` | `sentina-backend` |

---

## Troubleshooting

**Tests fail with "Could not connect"**
- Check the broker is running: `docker compose ps`
- Check EMQX is healthy: `docker exec sentina-emqx emqx ping`
- Confirm certificates exist in `certs/` and were generated with the correct CN

**`paho-mqtt not installed`**
```bash
pip install paho-mqtt
```

**T5/T6/T7 fail (ACL not enforced)**
- Verify the custom ACL file is being loaded (not the built-in default):
  ```bash
  docker exec sentina-emqx emqx eval \
    'Sources = emqx_authz:lookup(file), io:format("~p~n", [maps:get(rules, maps:get(annotations, Sources))]).'
  ```
  The output should show your custom rules (edge-node, sentina-backend, etc.), not `{allow,all,all,[['#']]}`.
- If it shows the default rules, ensure the volume mount in `docker-compose.yml` targets `/opt/emqx/etc/acl.conf` and restart: `docker compose down && docker compose up -d`

**Container won't start**
```bash
docker compose logs broker
```
