# Kiss Cut

Turns a logo or picture into a smooth, layered SVG for Cricut heat-transfer vinyl. It picks the colors, removes the background, cleans up jaggies and specks, tucks layers under each other so misalignment doesn't show, and exports a layered SVG for Design Space, one SVG per color, or a 300 dpi PNG for Print Then Cut.

Saving a project stores the image, every setting and every edit on the server and gives you a link. Anyone who opens the link picks up exactly where it was left off.

Everything runs in the browser except saving. The server is one Node file with no dependencies.

## Run it

```sh
docker compose up -d --build
```

Then open `http://<server>:8094`.

`docker-compose.yml` builds the image from this folder. Once the GitHub workflow has published it, remove the `build: .` line to pull `ghcr.io/au12/kisscut:latest` instead.

## Unraid

Either use the compose file with the Compose Manager plugin, or add it as a regular container:

1. Copy `unraid/kisscut.xml` to `/boot/config/plugins/dockerMan/templates-user/my-kisscut.xml`.
2. In **Docker → Add Container**, choose the **kisscut** template.
3. Keep **Projects** at `/mnt/user/appdata/kisscut` and **PUID/PGID** at `99`/`100`, set **Public URL** to the address you'll share, and apply.

If the GHCR package is private (it is by default when the repo is private), log in once from the Unraid terminal so it can pull:

```sh
docker login ghcr.io -u au12    # password: a GitHub token with read:packages
```

## Nginx Proxy Manager

Add a proxy host, for example `kisscut.yourdomain`:

- **Scheme** `http`, **Forward hostname/IP** your Unraid address, **Forward port** `8094`.
- On the **SSL** tab, request a certificate and turn on **Force SSL**.
- Set `TRUST_PROXY=true` and `PUBLIC_URL=https://kisscut.yourdomain` on the container so share links and link previews use the public address.

If saving a large photo fails with "413 Request Entity Too Large", the proxy is capping uploads. Add this on the proxy host's **Advanced** tab:

```nginx
client_max_body_size 30m;
```

## How saving and sharing works

- **Save & share** (or Ctrl+S / ⌘S) uploads the image and the project state and puts the link in the address bar as `/p/<id>`.
- The browser that first saved a link gets a private edit key, kept in that browser. Saving again from there updates the same link.
- Anyone else who opens the link gets the image, settings, layer colors, merges, deleted pieces and press order. When they save, they get a new link of their own, and the original stays as it was.
- There are no accounts. A link is a random 10-character ID, so links can't be guessed, but anyone you send one to can view it.
- Opening a new image or the sample starts a new project. The old link keeps working.

## Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8080` | Port inside the container. |
| `DATA_DIR` | `/data` | Where projects are stored. Map it to a host folder. |
| `PUID` / `PGID` | `1000` / `1000` | Owner of saved files. Use `99` / `100` on Unraid. |
| `PUBLIC_URL` | empty | Base address for share links and previews, e.g. `https://kisscut.example.com`. Empty uses the browser's address. |
| `TRUST_PROXY` | `false` | Set to `true` behind a reverse proxy so rate limits use the real client address. |
| `MAX_IMAGE_MB` | `25` | Largest image a save can upload. Bigger photos are re-encoded by the browser before upload. |
| `PROJECT_TTL_DAYS` | `0` | `0` keeps projects forever. Otherwise a project nobody has opened or saved in this many days is deleted. |
| `SAVES_PER_HOUR` | `60` | Saves allowed per client address per hour. `0` turns the limit off. |
| `MAX_STORAGE_MB` | `0` | `0` means no cap. Past this much disk, new projects are refused; updates to existing ones still work. |

If the instance is reachable from the internet, set `PROJECT_TTL_DAYS` and `MAX_STORAGE_MB`. Saving is open to anyone who can load the page.

## Data and backups

Each project is a folder under `/data/projects/<id>/`:

- `image` is the source image as uploaded.
- `state.json` holds the settings and edits.
- `meta.json` holds timestamps, image info and a hash of the edit key.

Back up the `/data` folder to keep everything. Delete a project's folder to remove it.

## Changing the app

The page is built from three files in `src/`:

- `engine.js` does the color picking, cleanup, tracing and layering, in a Web Worker.
- `app.js` is the interface.
- `shell.html` holds the markup and styles.

```sh
node build.js                        # writes server/public/index.html (and dist/kisscut.html)
DATA_DIR=./data node server/server.js
```

The Docker build runs `build.js` itself. Pushing to `main` (or a `v*` tag) runs `.github/workflows/docker-publish.yml`, which publishes `ghcr.io/au12/kisscut` for amd64 and arm64.

Fonts (Archivo and IBM Plex Mono) are bundled under the SIL Open Font License; see `server/public/fonts/OFL.txt`.
