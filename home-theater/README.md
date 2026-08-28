# Home Theater Dashboard

A wall-panel dashboard for one room, sized for an **iPad mini in landscape
(1024×768)**, backed by a small Express hub that fans commands out to the local
device APIs.

## Running it

```bash
npm install
npm run dev      # hub on :4100 + Vite dev server on :5173
```

Open `http://<your-mac>.local:5173` on the iPad. Vite proxies `/api` to the hub,
so both work over the LAN.

For the panel that actually lives on the wall, build once and let the hub serve
everything from a single port:

```bash
npm run build
npm start        # http://<host>:4100
```

Add it to the iPad home screen — `apple-mobile-web-app-capable` makes it open
full-screen with no Safari chrome.

## Layout

| Column | Contents |
|---|---|
| Video & Display | LG TV power, source pills (Apple TV / NVIDIA Shield), live signal path, D-pad remote |
| Sonos Audio | Volume slider with ±1% steps, one-tap levels, mute, Night Mode + Speech Enhancement |
| Lighting & Sync | Hue Sync Box (active / mode / intensity), Hue bias light, Kasa room dimmer with 0% / 100% |
| Macro bar | Movie Start · Intermission · System All Off |

The left rail is functional, not decorative: remote, hub activity log, and a
manual state refresh, with a dot showing whether the hub is answering.

### Design constraints it holds to

- True black (`#000000`) background so the OLED panel switches pixels off, with
  `#1e293b` hairlines separating cards.
- Amber (`#f59e0b`) means light output; cyan (`#38bdf8`) means signal path.
- Every control is at least 48px. Sliders are 48px tall inputs with a slim
  visible track — dragging a 14px line with a fingertip is the classic
  wall-panel failure.
- No blurs, no shadows, no spring animations. The only transition is a 120ms
  linear slide on switch knobs. Slider fills are painted onto the track with a
  gradient rather than stacked layers, which is what keeps dragging smooth on an
  older Safari.

## API

The hub owns room state; the dashboard is a view of it. Every mutating call
answers with the full updated state, so a second iPad or a physical remote can
change the room without the panel drifting.

| Method | Path | Body |
|---|---|---|
| GET | `/api/state` | — |
| GET | `/api/log` | — |
| POST | `/api/macro/:name` | `movie-start` · `intermission` · `all-off` |
| POST | `/api/tv/power` | `{ power }` (omit to toggle) |
| POST | `/api/tv/remote` | `{ key }` — up/down/left/right/ok/back/home/menu/playpause |
| POST | `/api/source` | `{ source: 'appletv' \| 'shield' }` — moves TV input *and* Sync Box HDMI |
| POST | `/api/sonos/volume` | `{ volume }` or `{ delta }` |
| POST | `/api/sonos/mute` | `{ muted }` (omit to toggle) |
| POST | `/api/sonos/toggle-nightmode` | `{ on }` (omit to toggle) |
| POST | `/api/sonos/toggle-speech` | `{ on }` (omit to toggle) |
| POST | `/api/syncbox/state` | any of `{ sync, mode, intensity, source }` |
| POST | `/api/lights/dim` | `{ device: 'bias' \| 'room', level }` |

## Wiring it to real gear

`server/devices.js` normalises every action into a `{ device, command, payload }`
envelope. With no bridge configured it records the call and returns — that's the
mock mode this ships in. Point a driver at a real endpoint and the same envelope
goes out over HTTP as `POST <bridge>/<command>`:

```bash
TV_BRIDGE_URL=http://192.168.1.20:8080/lg \
SONOS_BRIDGE_URL=http://192.168.1.21:5005/theater \
SYNCBOX_BRIDGE_URL=http://192.168.1.22/api/v1 \
LIGHTS_BRIDGE_URL=http://192.168.1.23:9000/kasa \
npm start
```

The hub deliberately doesn't speak webOS, SOAP, or the Hue v1 API itself — those
belong in per-device bridges (node-sonos-http-api and friends) so a device going
offline is a `failed` line in the activity log rather than a hung dashboard. The
header chip reads **Mock hub** until at least one bridge is configured.

Hub state is in memory: restarting it forgets the room, it doesn't re-read it.
Whatever the devices were last told stays true until something asks them again.
