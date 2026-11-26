# Screen display widgets and app plugins

## Plugin contributions

New faces and home widgets are registered through the extension host's generic
extension points. A contributor declares `contributions` in its own manifest;
the screen plugin provides `screen-display.face` and `screen-display.widget`.
There is no screen-specific registration command or shared directory to edit.
Enabled contributors appear in the Web designer and on the device; disabling
or removing one removes its entries. See
[`onekvm-extension-host/docs/extension-points.md`](https://github.com/onekvm/onekvm-extension-host/blob/main/docs/extension-points.md)
for the generic protocol and
[`onekvm-screen-display/docs/extension-points.md`](https://github.com/onekvm/onekvm-screen-display/blob/main/docs/extension-points.md)
for the face and widget contracts. The same host mechanism supports extension
points owned by other plugins.

The app launcher now uses the `screen-display.app` extension point. The legacy
directory registry below remains available for packaged compatibility overrides
and old widget drop-ins; it is not required for a new App.

The screen plugin itself also provides repeatable text, status, line, and
rectangle components. These are saved as layout instances, not registered as
apps. App-only entries therefore never appear in the home component menu.

## App launcher and legacy widget drop-ins

Shell apps are **plugins**, not built into the Shell. A new extension declares
`screen-display.app` in its manifest and points the contribution's `bundle`
field at a PocketJS bundle directory inside its package. The bundle must
contain `main.vue-vapor.js` and `main.vue-vapor.pak`; the extension host adds
the package root to the resolved contribution. The launcher ID is
`<extension-id>/<local-id>`.

Built-in apps and older packages may still drop a PocketJS bundle plus
`plugin.json` in `$POCKETJS_DIST/apps/<id>`. Later JSON for the same `id` wins:

| Path | Role |
|------|------|
| `$POCKETJS_DIST/apps/<id>/plugin.json` | Packaged with the app (PocketJS bundle next to it) |
| `/usr/share/onekvm/display/apps/<id>.json` | Extra registration from another IPK |
| `$ONEKVM_EXTENSION_DATA/apps/<id>.json` | Durable override |

```json
{
  "id": "settings",
  "title": "设置",
  "icon": "settings.png",
  "slots": ["app"],
  "order": 10
}
```

Icon launcher pages are `icon_columns` × `icon_rows` (default 3×3). Machines
set this in `/usr/share/onekvm/machine.json` `screen_display`, or override
with `/usr/share/onekvm/screen-display/launcher.json`:

```json
{ "icon_columns": 3, "icon_rows": 3, "icon_size": 52, "list_rows": 4 }
```

`icon_size` is the orb diameter in logical px. List mode pages `list_rows`
items. Swipe left/right moves home ↔ app pages.

`id` is `[a-z0-9_-]{1,31}`. `slots` may include `app` and/or `complication`.
The host exposes the registry as `onekvm.get("apps")` (JSON array) and as
`apps_json` on D-Bus `GetSettings`. The app launcher uses it automatically.
The Web designer only lists entries registered for the `complication` home
slot; App-only entries do not appear in its Add widget menu.
Launch is `onekvm.set("launch", "<id>")` for a registered id.

Complications / live icons still use widget drop-ins:

Other OneKVM components register circular complications / app icons by dropping
JSON into one of these directories (later paths override earlier ones for the
same `id`):

| Path | Role |
|------|------|
| `/usr/share/onekvm/display/widgets/<id>.json` | Packaged with an IPK |
| `$ONEKVM_EXTENSION_DATA/widgets/<id>.json` | Durable (`/data/onekvm/app-data/screen-display/widgets`) |
| `/run/onekvm/display/widgets/<id>.json` | Live state (on / subtitle) |

A drop-in with the same id can change title, icon, slots, or live state.

The extension id is `screen-display`. The presenter reads the live
`/dev/fb0` size and shape (`info` / `--info`) and letterboxes the 240×240
logical UI onto that panel. The designer preview uses the same geometry.

## Schema

```json
{
  "id": "wake-on-lan",
  "source": "wake-on-lan",
  "title": "WOL",
  "glyph": "W",
  "icon": "settings",
  "subtitle": "LAN",
  "accent": "amber",
  "on": true,
  "slots": ["complication", "app"],
  "order": 40,
  "image": "icon.rgb565",
  "frames": ["a.rgb565", "b.rgb565"],
  "frame_ms": 100
}
```

`accent` is `amber`, `cyan`, `violet`, `ink`, or `#rrggbb`.
`icon` is `hdmi`, `usb`, `net`, or `settings`.
`image` / `frames` are `R565` files relative to the JSON directory (color 0 is
transparent). `slots` may include `complication` and/or `app`.
`id` is `[a-z0-9_-]{1,31}`.

## Invoke / CLI

```sh
onekvm-extension invoke screen-display list
onekvm-extension invoke screen-display register < widget.json
onekvm-extension invoke screen-display unregister '{"id":"wake-on-lan"}'
onekvm-screen-display widget list
onekvm-screen-display widget register
onekvm-screen-display widget unregister wake-on-lan
```
