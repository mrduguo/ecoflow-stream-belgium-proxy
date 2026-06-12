# Man In The Middle Proxy

A generic HTTPS MITM (man-in-the-middle) debug proxy. Routes traffic from any device on your local network through your computer, decrypts it, logs it, and forwards it transparently.

## How it works

```
Device (proxy → computer:3128)
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
- Device and computer on the **same network**

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

On first startup the proxy generates a CA (if `certificates/ca.crt` is missing), then generates a fresh server certificate (signed by that CA, covering all hosts in `hosts.ts`), and prints:

```
CA certificate not found, generating...
CA certificate ready — install certificates/ca.crt on your device.
Generating server certificate...
Server certificate ready.
CONNECT proxy listening on :3128
Set device proxy → <your-ip>:3128
Proxy auto-config (PAC) → http://<your-ip>:3128/proxy.pac
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

### 4. Set the proxy on your device

Two options — PAC is easier as it needs no manual IP/port entry and works across networks:

**Option A — Proxy Auto-Config (PAC)** *(recommended)*

| Device | Path |
|--------|------|
| iPhone / iPad | Settings → Wi-Fi → your network → Configure Proxy → **Automatic** → URL: `http://<your-ip>:3128/proxy.pac` |
| macOS | System Settings → Network → [interface] → Details → Proxies → **Automatic Proxy Configuration** → URL: `http://<your-ip>:3128/proxy.pac` |

**Option B — Manual**

| Device | Path |
|--------|------|
| iPhone / iPad | Settings → Wi-Fi → your network → Configure Proxy → **Manual** → Server: `<your-ip>` · Port: `3128` |
| macOS | System Settings → Network → [interface] → Details → Proxies → **Web Proxy (HTTP)** and **Secure Web Proxy (HTTPS)** → `<your-ip>:3128` |

### 5. Watch the log

Traffic is logged to the console. When started with `deno task start` (background), the output is captured in `tmp/proxy.log`:

```sh
tail -f tmp/proxy.log
```

### 6. Restore your device

Remove the proxy and certificate when done:

**iPhone:** Settings → Wi-Fi → your network → Configure Proxy → Off (or clear the PAC URL)  
Settings → General → VPN & Device Management → remove the profile

**macOS:** System Settings → Network → [interface] → Details → Proxies → uncheck the proxy options and clear the PAC URL

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

Both requests show up in the traffic log.

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
The CA cert is valid for 10 years and is generated automatically on first start. To regenerate, delete the existing CA and restart:
```sh
rm certificates/ca.crt certificates/ca.key && deno task start
```
This writes a fresh `certificates/ca.crt` and `certificates/ca.key`. Reinstall the new CA cert on your device after regenerating.

**"Connection is not private"**  
The CA cert is not fully trusted — make sure you completed the Certificate Trust Settings step. Server certs are regenerated on every startup, so cert expiry is not normally a concern.

**Traffic not being intercepted**  
Check the traffic log for `CONNECT` lines — if the hostname doesn't match what's in `src/hosts.ts`, add it and restart.

**Different host than expected**  
Watch the `CONNECT` lines on first app launch to discover the actual hostname your app is connecting to.
