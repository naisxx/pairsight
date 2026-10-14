# PairSight on-premises

PairSight installed on a customer's own Windows machine, so their records,
accounts and results stay on it and we have no access to any of them. The
only thing that leaves the machine is the Jev calls a run makes, with the
customer's own Jev key.

The approved plan, in build order (one PR each):

1. **Jev key in the app** (done): an admin sets the key on Settings.
2. **On-prem profile** (done): `PAIRSIGHT_DEPLOYMENT=onprem`, a bundled
   rate card instead of the daily OpenRouter fetch, the first account
   becomes the admin, and admins manage people in Settings.
3. **Container image and Compose** (done): Postgres, GoTrue (local
   accounts), Caddy and the app (with Splink), on `127.0.0.1` only.
4. **Windows installer** (done): a setup that checks the machine, writes
   the config and secrets, starts the stack, and adds Open, Stop and Back up
   to the Start menu. Signed once the certificate is bought.

## The Jev key

Runs use the Jev connection an admin saved on **Settings** (account menu,
then Settings). Hosted, they otherwise fall back to the server's own
`TYPESAFE_API_KEY` and `TYPESAFE_API_BASE_URL`; on-prem they don't (see
below), so a customer's runs only ever use the customer's own key.

- **Checked before it's saved.** Jev is asked about one made-up pair, as a
  normal tracked call (`ai_usage` feature `pairsight_jev_key_check`). A
  refused key, an address that can't be reached or an odd answer is
  reported and nothing is saved.
- **Stored encrypted.** AES-256-GCM (`src/server/lib/secrets/crypto.ts`)
  under `PAIRSIGHT_SECRET_KEY`, which lives only in the server's
  environment. The database holds the ciphertext and the key's last four
  characters, nothing else. The key is never sent back to a page, logged
  or put in an error.
- **One per worker pool** (`jev_connections.pool` = `RUN_WORKER_POOL`), so
  servers that share a database keep their own. On-prem there is one.
- **Who can change it:** an admin seat with `settings.manage`. Everyone
  signed in can see whether a key is set and its last four characters.
- **Without one**, Check and start says runs need a Jev key and links to
  Settings, and starting a run is refused. A run that only reuses earlier
  checks needs none.
- **Changing `PAIRSIGHT_SECRET_KEY`** makes the saved key unreadable:
  Settings says so, runs fall back to the server's own key (hosted, if
  any), and the admin saves the key again.

Make an encryption key with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## The on-prem profile

`PAIRSIGHT_DEPLOYMENT=onprem` (default `hosted`) switches what differs on a
customer's machine. Hosted behaviour is unchanged.

- **Only the customer's own Jev key.** `TYPESAFE_API_KEY` is ignored (the
  boot log warns if it's set), so until an admin saves a key, Settings says
  there's none and runs can't start. A developer's key in `.env` can't
  quietly stand in for theirs.
- **Nothing but Jev leaves the machine.** AI usage is still priced at
  write time, from `src/server/lib/ai-usage/rate-card.json` instead of
  OpenRouter's live catalogue. `pnpm ai:rate-card` rebuilds it;
  `pnpm check:ai-models` fails if it lacks a mapped model and says when its
  rates are behind. Sentry, PostHog and Slack stay unset. At boot the server
  logs one line naming every outside service it's set up to contact, and
  warns on-prem if that's more than Jev.
- **The first account is the admin** (`super_admin`), decided in a
  serializable transaction so two sign-ups at once can't both be. Later
  accounts aren't admins; the email-domain staff seats don't apply.
- **People, in Settings:** an admin sees everyone with an account and can
  make them an admin or stop them being one. Never themselves, never the
  last admin. Hosted, Settings lists no one.
- **Privacy** opens with what stays on the machine, and says this copy
  doesn't count usage or report errors to us.

`e2e/onprem.spec.ts` covers it, against an on-prem server on an empty
database (`E2E_ONPREM=1`), and the On-prem workflow runs it against the
Compose stack.

## The stack

`deploy/onprem/` holds everything an install runs: four containers in one
Compose project, `pairsight-onprem`.

| Service   | Image                              | Does                                                                             |
| --------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `db`      | `postgres:17.6-bookworm`           | PairSight's data and the accounts, in volume `pairsight-onprem-db`               |
| `auth`    | `supabase/gotrue:v2.197.0`         | Email-and-password accounts, confirmed as they're made (no email server)         |
| `gateway` | `caddy:2.10.2-alpine`              | The app on `127.0.0.1:3080`; sign-in on an unpublished port only the app reaches |
| `app`     | `ghcr.io/8xplays/pairsight-onprem` | The web server, the run worker inside it, and Splink's Python                    |

- **One image for every install** (`deploy/onprem/Dockerfile`): nothing per
  customer is baked in. Each start migrates, applies `prisma/run-once.sql`,
  then serves. The image carries the built app, without its source or the
  marketing site (below).
- **Accounts stay in their database.** GoTrue keeps them in its own `auth`
  schema as its own role (`deploy/onprem/initdb/`); PairSight's role owns
  everything else. The browser never talks to GoTrue: sign-in goes through
  the app's server, so GoTrue's port is never published.
- **Secrets** live in `deploy/onprem/.env`, made once per install with
  random values (`node scripts/onprem-env.mjs`, or the installer): the
  database passwords, GoTrue's signing secret and `PAIRSIGHT_SECRET_KEY`.
  Losing the file locks that install out of its data, so the script never
  replaces one.

Try it locally (Docker running):

```sh
docker build -f deploy/onprem/Dockerfile -t ghcr.io/8xplays/pairsight-onprem:dev .
node scripts/onprem-env.mjs --image ghcr.io/8xplays/pairsight-onprem:dev
docker compose -f deploy/onprem/compose.yaml up -d --wait
```

Then open http://localhost:3080. Add `-f deploy/onprem/compose.test.yaml`
for the Jev stub, and save any key with Jev's address
`http://jev-stub:4010/v1`, so runs cost nothing. `docker compose ... down`
stops it and keeps the data; `down --volumes` deletes it.

### What the image ships

The product only. The landing page and the demo are the marketing site: a
customer sees them on the hosted site, tries the demo there, then
downloads the installer. The image leaves them out, and local dev and the
hosted site keep them:

- **Their routes** live in one route group, `src/app/[locale]/(marketing)/`
  (`/` and `/sandbox`), which the Dockerfile deletes before building. On
  the image, `/` opens Evaluations, which sends anyone signed out to sign
  in (`src/proxy.ts`), and `/sandbox` is not found.
- **Their data:** the sign-in page and the empty dashboard preview the
  demo's run and link to it, through `src/server/pairsight/demo-preview.ts`.
  `next.config.ts` fixes `PAIRSIGHT_MARKETING=off` into an on-prem build, so
  that branch, and with it `landing-demo.ts` and the demo's snapshots, is
  dropped: those screens show their steps and forms only. Nothing seeds
  the demo (`prisma/demo` isn't in the image), and the landing page's copy
  (`HomePage`) is removed from `messages/` (`deploy/onprem/drop-messages.mjs`).
- Anything new for the marketing site goes in the route group, or behind
  `process.env.PAIRSIGHT_MARKETING !== 'off'` when a shared screen needs it.

Compiled output only: no source, and no source map to get back to it. A
customer has the image, so they can read anything in it.

- **The app:** Next's minified production build. The source maps it and
  its packages bring are removed, with the comments pointing at them
  (`deploy/onprem/strip-source-maps.mjs`). So are `services/` and
  `scripts/`, which file tracing copies whole because Splink's runner
  works from `process.cwd()`.
- **The start-up script** (`run-once-sql`): bundled into one minified file.
- **Splink's code:** Python bytecode, compiled `-OO` (docstrings dropped),
  with the `.py` files removed.
- **The build fails** if any `.map`, map comment, TypeScript or Python
  source, or a marker of the marketing site is in `/app`
  (`deploy/onprem/check-image.sh`). It all happens
  in the build stages, so nothing removed is left in an image layer.

What's readable all the same:

- **Data model:** the Prisma schema and migrations, which every start
  needs to migrate, and which the Prisma client embeds anyway.
- **Copy:** `messages/`.
- **Splink:** the open-source Python packages Splink runs on.

Minified code and bytecode deter casual reading, not a determined one: the
licence is the real protection. Jev's judging, the part that matters most,
never ships.

## Installing on Windows

`PairSight-Setup-<version>.exe` (`deploy/windows/pairsight.iss`, Inno
Setup) is a thin wrapper round `deploy/windows/pairsight.ps1`, which does
the work and can be run by hand
(`powershell -ExecutionPolicy Bypass -File pairsight.ps1 <command>`).

- **The look:** themed to the app, in Setup and Uninstall alike. It follows
  Windows' light or dark setting, on the app's background colours, beside
  art rendered from its tokens and wordmark font
  (`deploy/windows/art/render.mjs` writes the PNGs; rerun it after a brand
  change). Inno Setup 6.7 or later. Its fonts and controls are Windows'
  own.
- **The pages:** Welcome, a desktop-shortcut choice, the machine check, Ready
  (listing what the check found), Installing and Finished. The script runs
  hidden with `-Progress`, writing `::step::`, `::ok::` and `::error::`
  lines that setup shows as it goes, so no console window opens. If the
  stack doesn't start, the last page says why instead of "ready".

- **Before copying anything** it checks (`check`): Docker Desktop installed
  and running (it starts it if it's installed), at least 8 GB of memory and
  10 GB free on the system drive, and port 3080 free. When Docker Desktop
  won't start it checks WSL, which Docker Desktop runs on, and if that's
  missing says to run `wsl --install`. Each failure says what to do.
  Windows 10 2004 or later, 64-bit. Docker Desktop and WSL are the only
  things the customer installs first; setup does the rest.
- **Building it locally:** `winget install JRSoftware.InnoSetup --scope user`,
  then `ISCC.exe /DImageRef=<an image Docker already has> deploy\windows\pairsight.iss`
  writes `deploy\windows\Output\PairSight-Setup-0.0.0-dev.exe`. An image
  that's already local isn't downloaded, so this tries a build before it's
  published.
- **Installing** (`install`): the script and the stack's files go in
  `Program Files\PairSight`; the config (compose.yaml, Caddyfile and `.env`
  with this install's secrets) in `%ProgramData%\PairSight`, readable only
  by Administrators, SYSTEM and whoever installed it. Then it downloads the
  release's image (pinned by digest), starts the stack and opens
  http://localhost:3080.
- **Start menu:** Open PairSight (`start`), Stop PairSight (`stop`, data
  kept) and Back up PairSight (`backup`). Docker Desktop restarts the stack
  when it starts, so after a reboot PairSight comes back once Docker does.
- **Backups** (`backup`) are database dumps in `Documents\PairSight
backups`: every evaluation, result and account. `restore -File <dump>`
  backs up first, then replaces the data. A dump restored on another
  install loses only the saved Jev key (encrypted with the first install's
  key): an admin saves it again.
- **Updating:** run the newer setup. It backs up, keeps the secrets, and
  starts the new image; start-up migrates the database.
- **Uninstalling** (Windows Settings, Apps; or Start menu, Uninstall
  PairSight) asks to keep or delete the data (keep is the default), then
  stops it, its progress shown as setup's is. Backups are never deleted.
  Reinstalling picks the kept data up. Docker Desktop has to be running,
  since PairSight's containers restart with it: if it isn't, uninstall
  stops before removing anything and says to start it.
  If the data is still there but `%ProgramData%\PairSight\.env` isn't,
  setup refuses rather than locking it out: put the file back, or
  `uninstall -DeleteData`.

## Releasing

Push a tag `onprem-v<version>` (e.g. `onprem-v1.0.0`). The On-prem release
workflow builds the image, pushes it to `ghcr.io/8xplays/pairsight-onprem`
(`<version>` and `latest`), builds `PairSight-Setup-<version>.exe` pinned to
that image's digest, and publishes both as a GitHub Release. The On-prem
workflow compiles the installer on every PR that touches it.

Before the first release:

- **Make the image public:** GHCR packages start private, and customers
  download without signing in. Package settings, then Change visibility,
  once. The image holds the built app, not its source.
- **Signing:** until the repository has the secrets `WINDOWS_SIGNING_CERT`
  (the code-signing certificate's `.pfx`, base64) and
  `WINDOWS_SIGNING_PASSWORD`, setup is published unsigned, Windows
  SmartScreen warns before it runs, and the release notes say so. With
  them, setup and its uninstaller are both signed.
