#!/usr/bin/env sh
set -eu

APP="${1:-platform}"
NAMESPACE="${2:-development}"

if ! kubectl config current-context >/dev/null 2>&1; then
  printf 'No Kubernetes current-context is set. Export KUBECONFIG or run kubectl config use-context first.\n' >&2
  exit 1
fi

printf 'Kubernetes context: '
kubectl config current-context

printf '\nApp %s in namespace %s:\n' "$APP" "$NAMESPACE"
kubectl get deployment,replicaset,pod,svc -n "$NAMESPACE" -l "app=$APP" -o wide || true

printf '\nDeployment image and env:\n'
kubectl get deployment "$APP" -n "$NAMESPACE" -o jsonpath='{range .spec.template.spec.containers[*]}container={.name} image={.image}{"\n"}{range .env[*]}{.name}={.value}{"\n"}{end}{end}' || true
printf '\n'

printf '\nRollout status:\n'
kubectl rollout status "deployment/$APP" -n "$NAMESPACE" --timeout=20s || true

printf '\nDeployment describe:\n'
kubectl describe deployment "$APP" -n "$NAMESPACE" || true

printf '\nPods describe:\n'
for pod in $(kubectl get pods -n "$NAMESPACE" -l "app=$APP" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null); do
  printf '\n--- %s ---\n' "$pod"
  kubectl describe pod "$pod" -n "$NAMESPACE" || true
done

printf '\nRecent logs:\n'
kubectl logs -n "$NAMESPACE" -l "app=$APP" --tail=160 --all-containers=true || true
