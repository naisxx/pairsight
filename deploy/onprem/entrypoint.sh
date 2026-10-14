#!/bin/sh
# Starts PairSight in its on-prem image (deploy/onprem/Dockerfile). Compose
# starts this once the database is healthy. Each step is safe to repeat, so
# every start, including the first and every update, runs the same two:
# bring the schema up to date, then apply any one-off SQL. Then the server
# (and the run worker inside it) takes over. There's no demo on-prem, so
# nothing is seeded.
set -eu

node tools/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema
node tools/scripts/run-once-sql.mjs

exec node server.js
