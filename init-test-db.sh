#!/bin/bash
# Runs automatically by the postgres image ONLY on first container init
# against a fresh, empty data directory (docker-entrypoint-initdb.d convention).
# Creates a second, separate database on the same Postgres server for e2e tests.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE "${DB_TEST_NAME}";
EOSQL