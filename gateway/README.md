# FSID OPC UA Edge Gateway

`fsid-gateway` is a small program that runs on a PC **inside the plant**. It reads the plant's OPC UA server and sends the readings to FSID over HTTPS. The PC only makes outgoing HTTPS connections, so you don't open any firewall ports or put the OPC UA server on the internet.

```
 Plant network                                   Internet
┌──────────────────┐ opc.tcp ┌───────────────┐  HTTPS (outbound only)  ┌──────────────┐
│ OPC UA server    │◄────────│ fsid-gateway  │────────────────────────►│ FSID backend │
│ (PLC / SCADA)    │  4840   │ (plant PC)    │  /gateway/v1/*          │ (Railway)    │
└──────────────────┘         └───────────────┘                         └──────────────┘
```

What the gateway reads is managed in the web app. Every minute it downloads its list of machines and OPC UA node IDs, so you can add machines or change tags without touching the plant PC.

## What you need

- A Windows or Linux PC (a Raspberry Pi works) that is always on, can reach the OPC UA server, and has internet access.
- The OPC UA server's endpoint URL, e.g. `opc.tcp://192.168.1.10:4840`.
- The server's security settings, and a username and password if it requires them.
- The node ID of each value you want, e.g. `ns=2;s=Line1.Motor3.Voltage`. To find them, browse the server with [UaExpert](https://www.unified-automation.com/products/development-tools/uaexpert.html) (free). Select a variable, and the **NodeId** field in its Attributes panel is the value to use.

## One-time setup in FSID

1. **Apply the database migration.** Run `add_opcua_gateways.sql` (repository root) once in the Supabase SQL editor, then redeploy the backend.
2. **Create a gateway.** Go to **Gateways** in the sidebar, click **Add gateway**, and copy the API key. The key is shown only once. Create one gateway per OPC UA server.
3. **Tell FSID which tags to read.** Use either way, or both:
   - **Per machine:** open the machine's page, find **Live data source (OPC UA)**, choose the gateway, and enter a node ID for each metric.
   - **Template (if tag names follow a pattern):** on the **Modules** page (superadmin), set the metric's *OPC UA node template*, e.g. `ns=2;s={machine_code}.Voltage`. Every machine with that module then uses it automatically. Placeholders: `{machine_code}`, `{machine_name}`, `{metric_code}`.

     On each machine page you still need to choose the gateway. A node ID typed on the machine page overrides the template for that machine.

## Install on the plant PC

1. **Copy the program.** Put the right build in a folder, e.g. `C:\fsid-gateway` or `/opt/fsid-gateway`:
   - `fsid-gateway-windows-amd64.exe`, renamed to `fsid-gateway.exe`
   - `fsid-gateway-linux-amd64`, renamed to `fsid-gateway`
   - `fsid-gateway-linux-arm64` for a Raspberry Pi with a 64-bit OS

   To build them yourself, see [Building](#building).
2. **Create the config file.** Copy `gateway.example.json` to `gateway.json` next to the program. Fill in `api_url` (your backend URL), `api_key`, and the `opcua` section. See the [config reference](#configuration) below.
3. **Check the setup:**
   ```
   fsid-gateway -once
   ```
   This connects, reads every configured tag once and prints a table of values and errors. It sends nothing. Fix any `ERROR` rows (usually a wrong node ID) on the machine page, then run it again.
4. **Start it permanently:**
   - **Windows:** in an elevated PowerShell, run
     ```
     powershell -ExecutionPolicy Bypass -File deploy\install-windows.ps1 -InstallDir C:\fsid-gateway
     ```
     This creates a startup task that runs as SYSTEM and restarts the gateway if it stops. It also locks `gateway.json` so only Administrators and SYSTEM can read it.
   - **Linux:** follow the commands at the top of `deploy/fsid-gateway.service`.
5. **Confirm it's working.** On the **Gateways** page the gateway should show **online** within a minute. Click it to see the connection, the tag count and any tags that failed. Live values then appear on the machine pages, the module dashboards and the Data Logs page.

## Configuration

| Key | Meaning |
|---|---|
| `api_url` | Your backend URL, e.g. `https://xyz.up.railway.app`. Must be `https://` (plain `http://` is only allowed for `localhost`). |
| `api_key` | Key from the Gateways page. Can be set with the env var `FSID_API_KEY` instead. |
| `opcua.endpoint` | OPC UA server URL. Env: `OPCUA_ENDPOINT`. |
| `opcua.security_policy` | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep`, `Aes256_Sha256_RsaPss`, or the older `Basic256` / `Basic128Rsa15`. |
| `opcua.security_mode` | `None`, `Sign` or `SignAndEncrypt`. Use `None` together with policy `None`. |
| `opcua.username` / `password` | Leave empty for anonymous access. Env: `OPCUA_USERNAME` / `OPCUA_PASSWORD`. |
| `opcua.certificate_file` / `private_key_file` / `application_uri` | Needed when the policy isn't `None`; see below. |
| `use_source_timestamp` | `true` uses the PLC's own timestamp; `false` (default) uses this PC's clock. |
| `buffer_file`, `max_buffered_readings` | Where readings are kept while the internet is down. Default: 500,000 readings, oldest dropped first. |
| `config_refresh_seconds` | How often the gateway reloads its tag list (default 60). |
| `log_file` | Log file path. The gateway also logs to the console. |

Relative paths are resolved against the folder containing `gateway.json`. The OPC UA username and password never leave the plant PC.

### Secure connections (Sign / SignAndEncrypt)

1. Run `fsid-gateway -gen-cert`. It creates `pki/gateway-cert.pem` and `pki/gateway-key.pem` and prints the three lines to add to `gateway.json`.
2. Set `security_policy` (usually `Basic256Sha256`) and `security_mode` (`SignAndEncrypt`).
3. Run `fsid-gateway -once`. The first attempt is normally rejected because the server doesn't trust the new certificate yet. In the server's certificate management (e.g. the `pki/rejected` folder, or its admin UI), move the FSID Gateway certificate to **trusted**, then run `-once` again.

If the policy and mode you chose aren't offered by the server, the error message lists the combinations it does offer.

## How it behaves

- **Reads** all tags every *poll interval* (default 5 s; change it on the Gateways page), batching up to 500 tags per request.
- **Lost OPC UA connection:** reconnects automatically, waiting 2 s and doubling up to 60 s between attempts.
- **Internet or backend down:** readings are kept in memory and saved to `buffer_file` every 30 s. When the connection returns they're uploaded in order, so the Data Logs page has no gaps. Buffered readings don't flash up on live dashboards.
- **Restart while offline:** the gateway restores its buffer and uses its last known tag list (`gateway-config-cache.json`), so it keeps reading.
- **Stopping:** with Ctrl+C, or a systemd stop, it makes a final upload attempt and saves anything left. When stopped from Task Scheduler on Windows, at most the last 30 s of unsent readings can be lost.
- **Bad tags** (wrong node ID, non-numeric value, bad quality) are skipped and listed on the Gateways page. Boolean tags are sent as 1 or 0.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `HTTP 401: invalid gateway key` | The key is wrong or was rotated. Paste the current key into `gateway.json` and restart. |
| `HTTP 403: gateway is disabled` | Enable the gateway on the Gateways page. |
| `get endpoints … connection refused / timeout` | The PC can't reach the OPC UA server. Check the IP and port, and that a firewall allows TCP 4840 from this PC. |
| `server has no endpoint with policy …` | Use one of the combinations listed in the error. |
| `BadUserAccessDenied` / `BadIdentityTokenRejected` | Wrong username or password, or the server doesn't allow that login method. |
| `BadSecurityChecksFailed` / `BadCertificateUntrusted` | Trust the gateway certificate on the server (see above). |
| `StatusBadNodeIDUnknown` for a tag | The node ID doesn't exist. Copy the exact NodeId from UaExpert. |
| Gateway online but `0 node(s)` | No machines are assigned to it, or none have node IDs. Set them on the machine pages. |
| Values arrive but no alerts | Set limits for the metrics on the Modules page. |

## Building

You need Go 1.24 or later. From this folder:

```bash
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w" -o dist/fsid-gateway-windows-amd64.exe .
GOOS=linux   GOARCH=amd64 go build -ldflags "-s -w" -o dist/fsid-gateway-linux-amd64 .
GOOS=linux   GOARCH=arm64 go build -ldflags "-s -w" -o dist/fsid-gateway-linux-arm64 .
```

Each build is a single file with no runtime dependencies.

## Backend API (for custom clients)

All requests send the header `X-Gateway-Key: <key>` (or `Authorization: Bearer <key>`).

- `GET /gateway/v1/config` returns the machines and node IDs to read, and the poll interval.
- `POST /gateway/v1/ingest` takes `{"readings":[{"machine_id":"…","metric_key":"voltage","value":415.2,"ts":"2026-11-19T11:30:50Z","unit":"V"}]}`, with at most 5000 readings per request. Readings for machines not assigned to this gateway are counted as `rejected`; they don't cause an error.
- `POST /gateway/v1/status` takes a free-form JSON health report, shown on the Gateways page.

The older `POST /opcua/ingest` still works for existing clients, but now also needs the gateway key, and only accepts machines from the gateway's company.
