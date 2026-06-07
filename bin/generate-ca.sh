#!/bin/sh
set -e

mkdir -p certificates

cat > /tmp/mitm_ca.cnf << 'EOF'
[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no

[dn]
CN = Man In The Middle Proxy CA
O = https://github.com/mrduguo/man-in-the-middle-proxy

[v3_ca]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always, issuer
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
EOF

echo "Generating CA key and certificate..."
openssl genrsa -out certificates/ca.key 4096
openssl req -x509 -new -nodes -key certificates/ca.key \
  -sha256 -days 3650 \
  -config /tmp/mitm_ca.cnf \
  -out certificates/ca.crt

rm -f /tmp/mitm_ca.cnf

echo ""
echo "Done. CA written to ./certificates/"
echo "  ca.crt — install this on your device"
echo "  ca.key — keep this private"
