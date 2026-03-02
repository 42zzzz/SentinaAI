#!/usr/bin/env bash
set -euo pipefail

# Generates a small self-signed PKI for local development.
# For production, use a proper CA and rotate certs securely.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CERT_DIR="$ROOT_DIR/services/security/certs"
mkdir -p "$CERT_DIR"

echo "Writing certs to: $CERT_DIR"

CA_KEY="$CERT_DIR/ca.key"
CA_CERT="$CERT_DIR/ca.crt"

SERVER_KEY="$CERT_DIR/server.key"
SERVER_CSR="$CERT_DIR/server.csr"
SERVER_CERT="$CERT_DIR/server.crt"

NR_KEY="$CERT_DIR/nodered.key"
NR_CSR="$CERT_DIR/nodered.csr"
NR_CERT="$CERT_DIR/nodered.crt"

TS_KEY="$CERT_DIR/telemetry-service.key"
TS_CSR="$CERT_DIR/telemetry-service.csr"
TS_CERT="$CERT_DIR/telemetry-service.crt"

DEVICE_KEY="$CERT_DIR/device-example.key"
DEVICE_CSR="$CERT_DIR/device-example.csr"
DEVICE_CERT="$CERT_DIR/device-example.crt"

# 1) CA
if [[ ! -f "$CA_KEY" ]]; then
  openssl genrsa -out "$CA_KEY" 4096
fi

if [[ ! -f "$CA_CERT" ]]; then
  openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days 3650 \
    -subj "/C=AE/ST=Dubai/L=Dubai/O=SentinaAI/OU=DevCA/CN=SentinaAI-Dev-CA" \
    -out "$CA_CERT"
fi

# Helper to sign a CSR
sign_csr() {
  local csr="$1"; local crt="$2"; local cn="$3";
  openssl x509 -req -in "$csr" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial \
    -out "$crt" -days 825 -sha256
}

# 2) Mosquitto server cert
openssl genrsa -out "$SERVER_KEY" 2048
openssl req -new -key "$SERVER_KEY" -subj "/C=AE/ST=Dubai/O=SentinaAI/OU=MQTT/CN=mosquitto" -out "$SERVER_CSR"
sign_csr "$SERVER_CSR" "$SERVER_CERT" "mosquitto"

# 2b) EMQX server cert (with SANs: localhost, emqx)
EMQX_KEY="$CERT_DIR/emqx.key"
EMQX_CSR="$CERT_DIR/emqx.csr"
EMQX_CERT="$CERT_DIR/emqx.crt"

openssl genrsa -out "$EMQX_KEY" 2048
openssl req -new -key "$EMQX_KEY" -subj "/C=AE/ST=Dubai/O=SentinaAI/OU=MQTT/CN=emqx" -out "$EMQX_CSR"

SAN_CFG="$CERT_DIR/emqx_san.cnf"
cat > "$SAN_CFG" <<EOF_SANS
subjectAltName=DNS:localhost,DNS:emqx,IP:127.0.0.1
EOF_SANS

openssl x509 -req -in "$EMQX_CSR" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial \
  -out "$EMQX_CERT" -days 825 -sha256 -extfile "$SAN_CFG"

# 3) Node-RED cert
openssl genrsa -out "$NR_KEY" 2048
openssl req -new -key "$NR_KEY" -subj "/C=AE/ST=Dubai/O=SentinaAI/OU=NodeRED/CN=nodered" -out "$NR_CSR"
sign_csr "$NR_CSR" "$NR_CERT" "nodered"

# 4) Telemetry service client cert (CN becomes MQTT username)
openssl genrsa -out "$TS_KEY" 2048
openssl req -new -key "$TS_KEY" -subj "/C=AE/ST=Dubai/O=SentinaAI/OU=Service/CN=telemetry-service" -out "$TS_CSR"
sign_csr "$TS_CSR" "$TS_CERT" "telemetry-service"

# 5) Example device client cert
openssl genrsa -out "$DEVICE_KEY" 2048
openssl req -new -key "$DEVICE_KEY" -subj "/C=AE/ST=Dubai/O=SentinaAI/OU=Device/CN=OCCZA03" -out "$DEVICE_CSR"
sign_csr "$DEVICE_CSR" "$DEVICE_CERT" "OCCZA03"

chmod 600 "$CERT_DIR"/*.key || true

echo "Done. Generated:"
ls -1 "$CERT_DIR" | sed 's/^/  - /'
