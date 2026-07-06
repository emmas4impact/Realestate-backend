#!/usr/bin/env sh
set -eu

NAMESPACE="${1:-development}"

if ! kubectl config current-context >/dev/null 2>&1; then
  printf 'No Kubernetes current-context is set. Export KUBECONFIG or run kubectl config use-context first.\n' >&2
  exit 1
fi

printf 'Kubernetes context: '
kubectl config current-context

printf '\nResources in namespace %s:\n' "$NAMESPACE"
kubectl get pods,pvc,svc,statefulset -n "$NAMESPACE"

printf '\nPersistent volumes:\n'
kubectl get pv

printf '\nRecent events in namespace %s:\n' "$NAMESPACE"
kubectl get events -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp || true

printf '\nPostgres StatefulSets:\n'
kubectl get statefulset -n "$NAMESPACE" | awk 'NR == 1 || /postgres/'

for pod in postgres-postgresql-0 postgres-postgresql-primary-0; do
  if kubectl get pod "$pod" -n "$NAMESPACE" >/dev/null 2>&1; then
    printf '\nDescribe pod %s:\n' "$pod"
    kubectl describe pod "$pod" -n "$NAMESPACE"

    printf '\nLogs for %s:\n' "$pod"
    kubectl logs "$pod" -n "$NAMESPACE" --tail=160 || true
  fi
done
