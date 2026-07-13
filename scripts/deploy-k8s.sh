#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
TARGET="${1:-all}"

if ! kubectl config current-context >/dev/null 2>&1; then
  printf 'No Kubernetes current-context is set. Export KUBECONFIG or run kubectl config use-context before deploying.\n' >&2
  exit 1
fi

show_postgres_debug() {
  environment="$1"

  printf '\nPostgres is not ready in namespace %s. Current resources:\n' "$environment" >&2
  kubectl get pods,pvc,svc,statefulset -n "$environment" >&2 || true
  printf '\nPostgres pod events:\n' >&2
  kubectl describe pod -n "$environment" postgres-postgresql-0 >&2 || true
  printf '\nPostgres logs:\n' >&2
  kubectl logs -n "$environment" postgres-postgresql-0 --tail=120 >&2 || true
}

wait_for_postgres() {
  environment="$1"

  if kubectl get statefulset postgres-postgresql -n "$environment" >/dev/null 2>&1; then
    if ! kubectl rollout status statefulset/postgres-postgresql -n "$environment" --timeout=300s; then
      show_postgres_debug "$environment"
      exit 1
    fi
  fi
}

show_deployment_debug() {
  environment="$1"
  deployment="$2"

  printf '\nDeployment %s is not ready in namespace %s. Current resources:\n' "$deployment" "$environment" >&2
  kubectl get deployment,replicaset,pod -n "$environment" -l "app=$deployment" >&2 || true
  printf '\nDeployment describe:\n' >&2
  kubectl describe deployment "$deployment" -n "$environment" >&2 || true
  printf '\nRecent logs for app=%s:\n' "$deployment" >&2
  kubectl logs -n "$environment" -l "app=$deployment" --tail=120 --all-containers=true >&2 || true
}

restart_and_wait_deployments() {
  environment="$1"

  deployments="$(kubectl get deployment -n "$environment" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)"
  if [ -z "$deployments" ]; then
    return
  fi

  kubectl rollout restart deployment -n "$environment"
  for deployment in $deployments; do
    if ! kubectl rollout status "deployment/$deployment" -n "$environment" --timeout=300s; then
      show_deployment_debug "$environment" "$deployment"
      exit 1
    fi
  done
}

deploy_environment() {
  environment="$1"

  if ! kubectl get namespace "$environment" >/dev/null 2>&1; then
    kubectl create namespace "$environment"
  fi

  NAMESPACES="$environment" sh "$SCRIPT_DIR/create-ecr-secret.sh"

  NAMESPACES="$environment" sh "$SCRIPT_DIR/create-app-secrets.sh"

  if ! kubectl get secret app-secrets -n "$environment" >/dev/null 2>&1; then
    printf 'Missing app-secrets in namespace %s. Create it before deploying.\n' "$environment" >&2
    exit 1
  fi

  (cd microservices && helmfile -e "$environment" sync --selector name=postgres)
  (cd microservices && helmfile -e "$environment" sync)
  wait_for_postgres "$environment"

  NAMESPACES="$environment" sh "$SCRIPT_DIR/create-app-secrets.sh"
  restart_and_wait_deployments "$environment"
}

case "$TARGET" in
  development | dev)
    deploy_environment development
    ;;
  staging | stage)
    deploy_environment staging
    ;;
  all)
    deploy_environment development
    deploy_environment staging
    ;;
  *)
    printf 'Usage: %s [development|staging|all]\n' "$0" >&2
    exit 1
    ;;
esac
