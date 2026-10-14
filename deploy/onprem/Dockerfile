# syntax=docker/dockerfile:1.7
#
# PairSight for a customer's own machine (docs/PairSight-OnPrem.md): the web
# server, the run worker inside it, and Splink's Python. Built from the repo
# root:
#
#   docker build -f deploy/onprem/Dockerfile -t ghcr.io/8xplays/pairsight-onprem:dev .
#
# One image for every install: nothing per-customer is baked in. Secrets, the
# database and sign-in addresses come from compose.yaml at run time, and the
# Jev key from Settings.

ARG NODE_IMAGE=node:22.22-bookworm-slim
ARG PYTHON_IMAGE=python:3.13-slim-bookworm

# --- The app build ----------------------------------------------------------
# openssl: Prisma picks its engines by the OpenSSL it finds, and guesses an
# old one when there's none. This stage and the runtime both have 3.
FROM ${NODE_IMAGE} AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY prisma/schema ./prisma/schema
# Scripts are skipped (the root `prepare` sets git hooks and needs git), so
# Prisma's engines are fetched (`rebuild` runs their own install) and its
# client generated explicitly.
RUN pnpm install --frozen-lockfile --ignore-scripts \
	&& pnpm rebuild @prisma/engines && pnpm exec prisma generate
COPY . .
ARG PAIRSIGHT_VERSION=dev
# On-prem builds the standalone server (next.config.ts). env.ts is checked
# during the build too; nothing connects to this database.
ENV PAIRSIGHT_DEPLOYMENT=onprem \
	NEXT_TELEMETRY_DISABLED=1 \
	NEXT_PUBLIC_APP_VERSION=${PAIRSIGHT_VERSION} \
	DATABASE_URL=postgresql://build:build@localhost:5432/build
# No marketing site: the landing page and the demo belong to the hosted
# site, for trying PairSight before buying it, so their routes aren't built.
# next.config.ts drops the rest of the demo (PAIRSIGHT_MARKETING=off).
RUN rm -rf "src/app/[locale]/(marketing)"
# Compiled output only, never source (docs/PairSight-OnPrem.md, "What the
# image ships"). File tracing follows splink/service.ts's process.cwd() paths
# and copies services/ and scripts/ whole: the runtime adds Splink back
# compiled, and the server reads nothing in scripts/. It brings the demo's
# files (prisma/demo) too, and the landing page's copy is in messages/. Then
# every source map goes.
RUN pnpm build && node deploy/onprem/copy-instrumentation.mjs \
	&& rm -rf .next/standalone/services .next/standalone/scripts .next/standalone/prisma/demo \
	&& node deploy/onprem/drop-messages.mjs .next/standalone/messages HomePage \
	&& node deploy/onprem/strip-source-maps.mjs .next/standalone .next/static
# The run-once SQL script as one minified file with no source map, so the
# image carries no source tree.
RUN pnpm dlx esbuild@0.25.10 scripts/run-once-sql.mjs --bundle --minify \
	--legal-comments=none --platform=node --format=esm --target=node22 \
	--external:@prisma/client --outfile=dist/run-once-sql.mjs

# --- Start-up tools ---------------------------------------------------------
# What each start runs before the server (entrypoint.sh): the Prisma CLI for
# migrations, at the lockfile's exact version, with a client of its own for
# the run-once script beside it. Prisma generates the client next to the
# `@prisma/client` it finds from the schema, so the schema is copied in here.
FROM build AS tools
RUN version=$(node -p "require('./node_modules/prisma/package.json').version") \
	&& mkdir -p /tools/scripts /tools/prisma && cd /tools && npm init -y >/dev/null \
	&& npm install --omit=dev --no-audit --no-fund "prisma@$version" "@prisma/client@$version" \
	&& cp -r /app/prisma/schema /tools/prisma/schema \
	&& npx prisma generate --schema /tools/prisma/schema \
	&& cp /app/dist/run-once-sql.mjs /tools/scripts/ \
	&& node /app/deploy/onprem/strip-source-maps.mjs /tools

# --- Splink's Python --------------------------------------------------------
FROM ${PYTHON_IMAGE} AS splink
COPY services/splink/requirements.txt /tmp/requirements.txt
# Long timeouts and retries: a slow line drops the index mid-install.
RUN python -m venv /opt/splink && /opt/splink/bin/pip install --no-cache-dir \
	--retries 10 --timeout 120 -r /tmp/requirements.txt

# --- Splink's code, compiled ------------------------------------------------
# Bytecode only: each module compiled beside where its source was (-b, so
# `python -m pairsight_splink` imports it with no source there), docstrings
# dropped (-OO; the code reads none and asserts nothing), then the source
# removed. Same Python as the runtime, which bytecode needs.
FROM ${PYTHON_IMAGE} AS splink-code
WORKDIR /splink
COPY services/splink/pairsight_splink ./pairsight_splink
RUN python -OO -m compileall -b -q pairsight_splink \
	&& find pairsight_splink -name '*.py' -delete \
	&& find pairsight_splink -name __pycache__ -prune -exec rm -rf {} +

# --- Runtime ----------------------------------------------------------------
# Python's image with Node's binary copied in: Splink needs 3.13, which
# Debian's own packages don't have.
FROM ${PYTHON_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=splink /opt/splink /opt/splink
RUN useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin pairsight
WORKDIR /app
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PAIRSIGHT_DEPLOYMENT=onprem \
	SPLINK_PYTHON=/opt/splink/bin/python \
	HOSTNAME=0.0.0.0 \
	PORT=3000

# The server and only the files it loads (messages among them), then what
# the standalone output leaves to the host: static assets and public/.
COPY --from=build --chown=pairsight:pairsight /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=tools /tools ./tools
COPY --from=build /app/prisma/schema ./prisma/schema
COPY --from=build /app/prisma/run-once.sql ./prisma/run-once.sql
COPY --from=splink-code /splink/pairsight_splink ./services/splink/pairsight_splink
COPY --chmod=755 deploy/onprem/entrypoint.sh /usr/local/bin/pairsight-entrypoint
# Fails the build if any source, source map or piece of the marketing site
# made it in. Mounted, not copied, so the check isn't shipped either.
RUN --mount=type=bind,source=deploy/onprem/check-image.sh,target=/tmp/check-image.sh \
	sh /tmp/check-image.sh

USER pairsight
EXPOSE 3000
ENTRYPOINT ["pairsight-entrypoint"]
