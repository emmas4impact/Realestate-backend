#!/usr/bin/env sh
set -eu

VERSION_FILE="${VERSION_FILE:-IMAGE_VERSION}"
AWS_REGION="${AWS_REGION:-eu-north-1}"
ECR_REGISTRY="${ECR_REGISTRY:-762760349103.dkr.ecr.eu-north-1.amazonaws.com}"
ECR_NAMESPACE="${ECR_NAMESPACE:-microservices}"
SERVICES="${SERVICES:-listings users tenants property inventory price platform search}"
DRY_RUN="${DRY_RUN:-false}"
BUILD_RETRIES="${BUILD_RETRIES:-3}"
BASE_IMAGES="${BASE_IMAGES:-node:22-alpine}"
CREATE_ECR_REPOS="${CREATE_ECR_REPOS:-true}"

tag_var_for_service() {
  printf '%s_IMAGE_TAG' "$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')"
}

repo_for_service() {
  case "$1" in
    listings) printf 'listing-service' ;;
    users) printf 'user-services' ;;
    tenants) printf 'tenant-service' ;;
    property) printf 'property-service' ;;
    inventory) printf 'inventory-service' ;;
    price) printf 'price-service' ;;
    platform) printf 'platform-service' ;;
    search) printf 'search-service' ;;
    *)
      printf 'Unknown service "%s"\n' "$1" >&2
      exit 1
      ;;
  esac
}

get_tag() {
  service="$1"
  var_name="$(tag_var_for_service "$service")"
  tag="$(awk -F= -v key="$var_name" '$1 == key { print $2 }' "$VERSION_FILE" | tail -n 1 | tr -d '[:space:]')"
  if [ -z "$tag" ]; then
    printf 'Missing %s in %s\n' "$var_name" "$VERSION_FILE" >&2
    exit 1
  fi
  printf '%s' "$tag"
}

retry() {
  attempts="$1"
  shift
  count=1
  until "$@"; do
    if [ "$count" -ge "$attempts" ]; then
      return 1
    fi
    sleep_seconds=$((count * 5))
    printf 'Command failed. Retry %s/%s in %ss: %s\n' "$count" "$attempts" "$sleep_seconds" "$*" >&2
    sleep "$sleep_seconds"
    count=$((count + 1))
  done
}

ensure_ecr_repository() {
  repository="$1"

  if aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$repository" >/dev/null 2>&1; then
    return
  fi

  if [ "$CREATE_ECR_REPOS" != "true" ]; then
    printf 'Missing ECR repository %s. Set CREATE_ECR_REPOS=true or ask AWS admin to create it.\n' "$repository" >&2
    exit 1
  fi

  printf 'Create missing ECR repository %s\n' "$repository"
  aws ecr create-repository \
    --region "$AWS_REGION" \
    --repository-name "$repository" \
    --image-scanning-configuration scanOnPush=true \
    >/dev/null
}

if [ "$DRY_RUN" != "true" ]; then
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
  for base_image in $BASE_IMAGES; do
    printf 'Pull base image %s\n' "$base_image"
    retry "$BUILD_RETRIES" docker pull "$base_image"
  done
fi

for service in $SERVICES; do
  tag="$(get_tag "$service")"
  repo="$(repo_for_service "$service")"
  repository="${ECR_NAMESPACE}/${repo}"
  image="${ECR_REGISTRY}/${repository}:${tag}"
  dockerfile="services/${service}/Dockerfile"

  if [ ! -f "$dockerfile" ]; then
    printf 'Missing Dockerfile: %s\n' "$dockerfile" >&2
    exit 1
  fi

  printf 'Build and push %s\n' "$image"
  if [ "$DRY_RUN" = "true" ]; then
    printf 'DRY RUN: ensure ECR repository %s\n' "$repository"
    printf 'DRY RUN: docker build -f %s -t %s .\n' "$dockerfile" "$image"
    printf 'DRY RUN: docker push %s\n' "$image"
    continue
  fi

  ensure_ecr_repository "$repository"
  retry "$BUILD_RETRIES" docker build -f "$dockerfile" -t "$image" .
  retry "$BUILD_RETRIES" docker push "$image"
  aws ecr describe-images \
    --region "$AWS_REGION" \
    --repository-name "$repository" \
    --image-ids "imageTag=$tag" \
    >/dev/null
done
