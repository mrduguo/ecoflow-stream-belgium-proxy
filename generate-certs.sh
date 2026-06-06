#!/bin/sh
set -e

mkdir -p certificates

echo "Generating CA key and certificate..."
openssl genrsa -out certificates/ca.key 4096
openssl req -x509 -new -nodes -key certificates/ca.key \
  -sha256 -days 3650 \
  -subj '/CN=EcoFlow Belgium Proxy CA/O=Local Dev' \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -out certificates/ca.crt

echo "Generating server key and certificate..."
openssl genrsa -out certificates/key.pem 4096
openssl req -new -key certificates/key.pem \
  -subj '/CN=EcoFlow Proxy' \
  -out certificates/server.csr

cat > /tmp/ecoflow_ext.cnf << 'EOF'
subjectAltName=DNS:localhost,DNS:api-e.ecoflow.com
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
EOF

openssl x509 -req -in certificates/server.csr \
  -CA certificates/ca.crt -CAkey certificates/ca.key \
  -CAcreateserial -days 825 -sha256 \
  -extfile /tmp/ecoflow_ext.cnf \
  -out certificates/cert.pem

rm -f certificates/server.csr certificates/ca.srl /tmp/ecoflow_ext.cnf

echo ""
echo "Done. Certificates written to ./certificates/"
echo "  ca.crt   — install this on your iPhone"
echo "  cert.pem — TLS server certificate"
echo "  key.pem  — TLS server private key"
