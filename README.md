# EcoFlow Stream 2300W Belgium Proxy

Unlocks the EcoFlow Stream 2300W for 2300W grid-tie export by intercepting the app's API call and changing the region to Belgium (`showAreaId: "23"`), which has the highest permitted output limit.

Based on the technique described at [Plugin Solar Explained](https://pluginsolarexplained.co.uk/blog/ecoflow-stream-2300w-unlock-grid-tie/).

> **Note:** This solution only works for the EcoFlow Stream series connected with a parallel cable.

> **Warning:** Increasing the output power affects your electrical installation. Always ensure your wiring, connectors, and components are rated for the load. If in doubt, consult a qualified electrician before making changes.

## How it works

The proxy runs on your computer and sits between the EcoFlow iPhone app and EcoFlow's cloud API:

```
iPhone (WiFi proxy → computer:3128)
  └─ CONNECT api-e.ecoflow.com:443
       └─ intercepted → localhost:3129 (our HTTPS server)
            └─ POST /app/system/property/save
                 └─ {"properties": {"showAreaId": "23"}, ...}  ← rewritten
                      └─ forwarded to real api-e.ecoflow.com
```

The proxy only modifies the one field (`showAreaId`) in the one endpoint (`/app/system/property/save`). All other EcoFlow API traffic passes through unchanged.

## Prerequisites

- [Deno](https://deno.com) runtime — install with:
  ```sh
  curl -fsSL https://deno.land/install.sh | sh
  ```
- `openssl` (pre-installed on macOS/Linux)
- iPhone and computer on the **same WiFi network**

## Setup

### 1. Start the proxy

```sh
deno task start
```

The proxy prints your computer's local IP and the cert URL on startup:

```
CONNECT proxy listening on :3128
Set iPhone WiFi proxy → <your-computer-ip>:3128
Install CA cert → open in iPhone Safari: http://<your-computer-ip>:3128/cert
```

### 2. Install the CA certificate on your iPhone

> Do this **before** setting up the proxy — Safari must not be going through the proxy yet.

1. Open the printed URL in **iPhone Safari** (e.g. `http://<your-computer-ip>:3128/cert`)
2. iPhone prompts *"Allow download of configuration profile"* → tap **Allow**
3. Go to **Settings → General → VPN & Device Management** → tap the profile → **Install**
4. Go to **Settings → General → About → Certificate Trust Settings**
5. Find **EcoFlow Belgium Proxy CA** and toggle it **on**

> Step 5 is required. Without it the certificate is installed but not trusted.

### 3. Set the iPhone WiFi proxy

1. **Settings → Wi-Fi** → tap your network name → scroll to **HTTP Proxy**
2. Select **Manual**
3. Server: `<your-computer-ip>` (printed by the proxy on startup — e.g. `192.168.1.47`)
4. Port: `3128`

### 4. Trigger the unlock

1. Open the **EcoFlow** app
2. Navigate to **Settings → Region** (or wherever grid/output settings live)
3. Change the region and tap **Save**
4. Watch `http-request.log` to confirm the intercept fired:

```
REQUEST   https://api-e.ecoflow.com/app/system/property/save  {"properties":{"showAreaId":"10"},...}
MODIFIED  https://api-e.ecoflow.com/app/system/property/save  {"properties":{"showAreaId":"23"},...}
RESPONSE [200] https://api-e.ecoflow.com/app/system/property/save  {"code":"0",...}
```

Close the EcoFlow app fully and reopen it — the Grid-tied output should now show **2300W**.

### 5. Restore your phone

Once unlocked, remove the proxy and certificate from your iPhone:

1. **Settings → Wi-Fi** → your network → HTTP Proxy → **Off**
2. **Settings → General → VPN & Device Management** → remove the profile

## Watching the log

```sh
tail -f http-request.log
```

All traffic through the proxy is logged. The `REQUEST` / `MODIFIED` / `RESPONSE` lines only appear for the unlock endpoint.

## Troubleshooting

**Certificates have expired**
The repo includes pre-generated certificates valid until **8 September 2028** (server cert) and **3 June 2036** (CA cert). After those dates, regenerate with:
```sh
chmod +x generate-certs.sh && ./generate-certs.sh
```

**"Connection is not private" in Safari**
The CA certificate is not fully trusted. Make sure you completed step 5 above (Certificate Trust Settings toggle). Also ensure the cert validity is ≤825 days — re-run `./generate-certs.sh` if in doubt.

**Different hostname than `api-e.ecoflow.com`**
Regional EcoFlow deployments may use a different API host. Check `http-request.log` for `CONNECT` lines when the app starts — if you see a different host, update `ECOFLOW_HOST` in `src/tunnel.ts` and add it to the SAN list in `generate-certs.sh`, then re-run `./generate-certs.sh` and restart.

**`showAreaId` not found in the request body**
A future app version may change the request format. Check the `REQUEST` log line to see the actual body and adjust `src/ecoflow.ts` accordingly.
