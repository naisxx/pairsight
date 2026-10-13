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
3. **Container images and Compose:** Postgres, GoTrue (local accounts),
   Caddy and the app (with Splink), on `127.0.0.1` only.
4. **Windows installer:** a signed setup that checks Docker Desktop, writes
   the config and secrets, starts the stack, and adds Start, Stop, Back up
   and Update.

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
database (`E2E_ONPREM=1`); PR 3 runs it against the Compose stack in CI.
