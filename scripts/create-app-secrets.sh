#!/usr/bin/env sh
set -eu

ENV_FILE="${ENV_FILE:-.env}"
NAMESPACES="${NAMESPACES:-development staging}"
SECRET_NAME="${SECRET_NAME:-app-secrets}"
POSTGRES_HOST="${POSTGRES_HOST:-}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

read_env_value() {
  key="$1"
  value="$(awk -F= -v key="$key" '$1 == key { print substr($0, length(key) + 2) }' "$ENV_FILE" | tail -n 1)"
  printf '%s' "$value"
}

if [ ! -f "$ENV_FILE" ]; then
  printf 'Missing env file: %s\n' "$ENV_FILE" >&2
  exit 1
fi

POSTGRES_USER="${POSTGRES_USER:-$(read_env_value POSTGRES_USER)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(read_env_value POSTGRES_PASSWORD)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env_value POSTGRES_DB)}"

if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_DB" ]; then
  printf 'POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB are required from env or %s.\n' "$ENV_FILE" >&2
  exit 1
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

detect_postgres_host() {
  namespace="$1"

  if [ -n "$POSTGRES_HOST" ]; then
    printf '%s' "$POSTGRES_HOST"
    return
  fi

  for candidate in postgres-postgresql-primary postgresql-primary postgres-postgresql postgresql postgres; do
    if kubectl get service "$candidate" -n "$namespace" >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return
    fi
  done

  detected="$(kubectl get service -n "$namespace" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | awk '/postgres|postgresql/ { print; exit }')"
  if [ -n "$detected" ]; then
    printf '%s' "$detected"
    return
  fi

  printf 'postgres-postgresql'
}

awk -F= '
  $1 == "DATABASE_URL" { next }
  $1 == "NODE_ENV" { next }
  NF > 0 { print }
' "$ENV_FILE" > "$tmp_file"

for namespace in $NAMESPACES; do
  if ! kubectl get namespace "$namespace" >/dev/null 2>&1; then
    kubectl create namespace "$namespace"
  fi

  namespace_tmp_file="$(mktemp)"
  postgres_host="$(detect_postgres_host "$namespace")"
  cp "$tmp_file" "$namespace_tmp_file"
  printf 'DATABASE_URL=postgresql://%s:%s@%s:%s/%s\n' "$POSTGRES_USER" "$POSTGRES_PASSWORD" "$postgres_host" "$POSTGRES_PORT" "$POSTGRES_DB" >> "$namespace_tmp_file"
  printf 'NODE_ENV=production\n' >> "$namespace_tmp_file"

  kubectl create secret generic "$SECRET_NAME" \
    --from-env-file="$namespace_tmp_file" \
    --namespace "$namespace" \
    --dry-run=client -o yaml | kubectl apply -f -
  rm -f "$namespace_tmp_file"

  printf 'Updated %s in namespace %s with DATABASE_URL host %s.\n' "$SECRET_NAME" "$namespace" "$postgres_host"
done
