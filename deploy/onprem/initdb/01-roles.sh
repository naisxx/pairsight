#!/bin/sh
# Runs once, when the database volume is first created (Postgres image's
# /docker-entrypoint-initdb.d), as the `postgres` superuser, which nothing
# else connects as. Two roles, each with its own password:
#   pairsight       owns the pairsight database: the app's tables, which its
#                   start-up migrations create
#   pairsight_auth  owns the `auth` schema only: sign-in (GoTrue) keeps the
#                   accounts there and can't reach PairSight's tables
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
	-v app_password="$APP_DB_PASSWORD" -v auth_password="$AUTH_DB_PASSWORD" <<'SQL'
CREATE ROLE pairsight LOGIN PASSWORD :'app_password';
ALTER DATABASE pairsight OWNER TO pairsight;
CREATE ROLE pairsight_auth LOGIN PASSWORD :'auth_password';
CREATE SCHEMA auth AUTHORIZATION pairsight_auth;
ALTER ROLE pairsight_auth SET search_path = auth;
SQL
