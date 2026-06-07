# Man In The Middle Proxy

A generic HTTPS MITM (man-in-the-middle) debug proxy. Routes traffic from any device on your local network through your computer, decrypts it, logs it, and forwards it transparently.

## How it works

```
Device (WiFi proxy → computer:3128)
  └─ CONNECT <intercepted-host>:443
       └─ redirected → localhost:3129 (HTTPS server)
            └─ logged → forwarded to real host
```

The proxy intercepts only the hosts listed in `src/hosts.ts`. All other traffic passes through unchanged as a standard CONNECT tunnel.

## Prerequisites

- [Deno](https://deno.com) runtime:
  ```sh
  curl -fsSL https://deno.land/install.sh | sh
  ```
- `openssl` (pre-installed on macOS/Linux)
- Device and computer on the **same WiFi network**

## Setup

### 1. Configure intercepted hosts

Edit `src/hosts.ts` to list the hostnames you want to intercept:

```typescript
export const INTERCEPT_HOSTS: string[] = [
  'api.example.com',
]
```

### 2. Start the proxy

```sh
deno task start
```

On startup the proxy generates a fresh server certificate (signed by your CA, covering all hosts in `hosts.ts`), then prints:

```
Generating server certificate...
Server certificate ready.
CONNECT proxy listening on :3128
Set device WiFi proxy → <your-ip>:3128
Install CA cert → open in device browser: http://<your-ip>:3128/ca.crt
```

### 3. Install the CA certificate on your device

> Do this **before** routing traffic through the proxy.

**macOS:**
```sh
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certificates/ca.crt
```
This adds the cert to the System keychain and marks it as a trusted root CA in one step. After this, `curl` and browsers will trust the proxy's certificates.

**iPhone / iPad:**
1. Open `http://<your-ip>:3128/ca.crt` in **Safari**
2. Tap **Allow** when prompted to download the profile
3. **Settings → General → VPN & Device Management** → tap the profile → **Install**
4. **Settings → General → About → Certificate Trust Settings** → enable **Man In The Middle Proxy CA**

Step 4 is required — without it the cert is installed but not trusted.

### 4. Set the WiFi proxy on your device

**iPhone / iPad:** Settings → Wi-Fi → your network → HTTP Proxy → Manual  
Server: `<your-ip>` (printed on startup) · Port: `3128`

### 5. Watch the log

```sh
tail -f tmp/http-request.log
```

### 6. Restore your device

Remove the proxy and certificate when done:

**iPhone:** Settings → Wi-Fi → your network → HTTP Proxy → Off  
Settings → General → VPN & Device Management → remove the profile

## Testing

With the proxy running, test locally using curl. `httpbin.org` is included in the default intercept list.

**HTTP request:**
```sh
curl -x http://127.0.0.1:3128 http://httpbin.org/get
```

**HTTPS request** (requires CA cert trusted by curl):
```sh
curl -x http://127.0.0.1:3128 https://httpbin.org/get --cacert certificates/ca.crt
```

Both requests are logged to `tmp/http-request.log`.

## Logging options

| Variable | Default | Effect |
|----------|---------|--------|
| `LOG_HEADER` | `false` | Log request and response headers for intercepted hosts |
| `LOG_BODY` | `false` | Log request and response bodies for intercepted hosts |

```sh
LOG_BODY=true deno task start
```

## Troubleshooting

**CA certificate expired or needs regenerating**  
The CA cert is valid for 10 years. To regenerate:
```sh
chmod +x bin/generate-ca.sh && ./bin/generate-ca.sh
```
This writes `certificates/ca.crt` and `certificates/ca.key`. Reinstall the new CA cert on your device after regenerating.

**"Connection is not private"**  
The CA cert is not fully trusted — make sure you completed the Certificate Trust Settings step. Server certs are regenerated on every startup, so cert expiry is not normally a concern.

**Traffic not being intercepted**  
Check `http-request.log` for `CONNECT` lines — if the hostname doesn't match what's in `src/hosts.ts`, add it and restart.

**Different host than expected**  
Watch the `CONNECT` lines on first app launch to discover the actual hostname your app is connecting to.
