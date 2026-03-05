#!/usr/bin/env bash
# scripts/gen_certs.sh — Generate TLS certificates for EMQX mTLS (NFR-26, NFR-28)
#
# Creates:
#   certs/ca.key / ca.crt              — Self-signed Certificate Authority
#   certs/server.key / server.crt      — EMQX broker TLS certificate
#   certs/<ID>.key / <ID>.crt          — Client certificate for a device or service
#
# In production, replace the self-signed CA with certs from your PKI / cloud CA.
#
# Usage:
#   cd services/mqtt-broker
#
#   # Step 1: Create CA + broker cert (run ONCE)
#   bash scripts/gen_certs.sh --server
#
#   # Step 2: Issue a cert for each device or service account (run per device)
#   bash scripts/gen_certs.sh --client sensor-HZA01-occ
#   bash scripts/gen_certs.sh --client edge-node
#   bash scripts/gen_certs.sh --client sentina-backend
#
# The Common Name (CN) of the client cert becomes the MQTT username in EMQX
# (via peer_cert_as_username = cn in emqx.conf), so it MUST exactly match the
# username used in authz/acl.conf ACL rules.

set -euo pipefail

# Git Bash on Windows translates arguments that start with "/" into Windows
# paths (e.g. "/CN=..." becomes "C:/Program Files/Git/CN=..."), which breaks
# the openssl -subj flag. This variable disables that translation.
export MSYS_NO_PATHCONV=1

CERTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$CERTS_DIR"

DAYS=825     # Max recommended by browsers; adjust to your security policy
CA_KEY="$CERTS_DIR/ca.key"
CA_CRT="$CERTS_DIR/ca.crt"

# ── Helpers ────────────────────────────────────────────────────────────────

gen_ca() {
    echo "==> Generating Certificate Authority (CA)..."
    openssl genrsa -out "$CA_KEY" 4096
    openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days $DAYS \
        -subj "/CN=SentinaAI-MQTT-CA/O=SentinaAI/C=AE" \
        -out "$CA_CRT"
    chmod 600 "$CA_KEY"
    echo "    CA written to: $CERTS_DIR/ca.{key,crt}"
}

gen_server_cert() {
    echo "==> Generating EMQX broker server certificate..."
    openssl genrsa -out "$CERTS_DIR/server.key" 2048
    openssl req -new -key "$CERTS_DIR/server.key" \
        -subj "/CN=mqtt.sentinai.local/O=SentinaAI/C=AE" \
        -out "$CERTS_DIR/server.csr"
    openssl x509 -req \
        -in "$CERTS_DIR/server.csr" \
        -CA "$CA_CRT" -CAkey "$CA_KEY" -CAcreateserial \
        -out "$CERTS_DIR/server.crt" \
        -days $DAYS -sha256
    rm "$CERTS_DIR/server.csr"
    chmod 600 "$CERTS_DIR/server.key"
    echo "    Broker cert written to: $CERTS_DIR/server.{key,crt}"
}

gen_client_cert() {
    local ID="$1"
    echo "==> Issuing client certificate for: '$ID'"
    echo "    (MQTT username in EMQX will be: $ID)"
    openssl genrsa -out "$CERTS_DIR/${ID}.key" 2048
    openssl req -new -key "$CERTS_DIR/${ID}.key" \
        -subj "/CN=${ID}/O=SentinaAI/C=AE" \
        -out "$CERTS_DIR/${ID}.csr"
    openssl x509 -req \
        -in "$CERTS_DIR/${ID}.csr" \
        -CA "$CA_CRT" -CAkey "$CA_KEY" -CAcreateserial \
        -out "$CERTS_DIR/${ID}.crt" \
        -days $DAYS -sha256
    rm "$CERTS_DIR/${ID}.csr"
    chmod 600 "$CERTS_DIR/${ID}.key"
    echo "    Client cert written to: $CERTS_DIR/${ID}.{key,crt}"
    echo ""
    echo "    Distribute to device/service:"
    echo "      ${ID}.key   <- private key  (keep secret, never share)"
    echo "      ${ID}.crt   <- public cert  (install on device)"
    echo "      ca.crt      <- trust anchor (install on device)"
}

# ── Argument parsing ────────────────────────────────────────────────────────

if [[ $# -eq 0 ]]; then
    echo "Usage:"
    echo "  bash scripts/gen_certs.sh --server                  # Generate CA + server cert"
    echo "  bash scripts/gen_certs.sh --client <DEVICE_ID>      # Issue a client cert"
    echo ""
    echo "Examples:"
    echo "  bash scripts/gen_certs.sh --server"
    echo "  bash scripts/gen_certs.sh --client sensor-HZA01-occ"
    echo "  bash scripts/gen_certs.sh --client edge-node"
    echo "  bash scripts/gen_certs.sh --client sentina-backend"
    exit 1
fi

case "$1" in
    --server)
        if [[ -f "$CA_KEY" ]]; then
            echo "CA already exists at $CA_KEY — skipping CA generation."
            echo "Delete certs/ to regenerate from scratch."
        else
            gen_ca
        fi
        gen_server_cert
        echo ""
        echo "Done. Start EMQX with: docker compose up -d"
        ;;
    --client)
        if [[ $# -lt 2 || -z "${2:-}" ]]; then
            echo "Error: --client requires a device ID argument."
            echo "  bash scripts/gen_certs.sh --client sensor-HZA01-occ"
            exit 1
        fi
        if [[ ! -f "$CA_KEY" ]]; then
            echo "Error: CA not found. Run --server first."
            exit 1
        fi
        gen_client_cert "$2"
        ;;
    *)
        echo "Unknown argument: $1"
        echo "Use --server or --client <ID>"
        exit 1
        ;;
esac
