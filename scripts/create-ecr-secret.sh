#!/usr/bin/env sh
set -eu

AWS_REGION="${AWS_REGION:-eu-north-1}"
ECR_REGISTRY="${ECR_REGISTRY:-762760349103.dkr.ecr.eu-north-1.amazonaws.com}"
NAMESPACES="${NAMESPACES:-development staging}"
SECRET_NAME="${SECRET_NAME:-ecr-secret}"

password="$(aws ecr get-login-password --region "$AWS_REGION")"

for namespace in $NAMESPACES; do
  if ! kubectl get namespace "$namespace" >/dev/null 2>&1; then
    kubectl create namespace "$namespace"
  fi

  kubectl create secret docker-registry "$SECRET_NAME" \
    --docker-server="$ECR_REGISTRY" \
    --docker-username=AWS \
    --docker-password="$password" \
    --namespace "$namespace" \
    --dry-run=client -o yaml | kubectl apply -f -

  printf 'Updated %s in namespace %s\n' "$SECRET_NAME" "$namespace"
done
