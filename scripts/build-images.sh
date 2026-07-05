#!/usr/bin/env sh
set -eu

VERSION_FILE="${VERSION_FILE:-IMAGE_VERSION}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-realestate}"
PUSH_IMAGES="${PUSH_IMAGES:-false}"
MANUAL_TAG="${1:-}"

if [ -n "$MANUAL_TAG" ]; then
  IMAGE_TAG="$MANUAL_TAG"
  BUMP_VERSION="false"
elif [ -n "${IMAGE_TAG:-}" ]; then
  BUMP_VERSION="false"
else
  if [ ! -f "$VERSION_FILE" ]; then
    printf '1.0.0\n' > "$VERSION_FILE"
  fi

  IMAGE_TAG="$(tr -d '[:space:]' < "$VERSION_FILE")"
  BUMP_VERSION="true"
fi

major="$(printf '%s' "$IMAGE_TAG" | cut -d . -f 1)"
minor="$(printf '%s' "$IMAGE_TAG" | cut -d . -f 2)"
patch="$(printf '%s' "$IMAGE_TAG" | cut -d . -f 3)"
extra="$(printf '%s' "$IMAGE_TAG" | cut -d . -f 4)"

case "$major:$minor:$patch:$extra" in
  *[!0-9:]* | ::* | *::* | *:::*)
    printf 'Invalid IMAGE_TAG "%s". Use semantic version format like 1.0.0.\n' "$IMAGE_TAG" >&2
    exit 1
    ;;
esac

if [ -n "$extra" ] || [ -z "$major" ] || [ -z "$minor" ] || [ -z "$patch" ]; then
  printf 'Invalid IMAGE_TAG "%s". Use semantic version format like 1.0.0.\n' "$IMAGE_TAG" >&2
  exit 1
fi

export IMAGE_TAG
export IMAGE_REGISTRY

docker compose build \
  listings-service \
  users-service \
  tenants-service \
  property-service \
  inventory-service \
  price-service \
  platform-service

push_image() {
  image="$1"

  if [ "$PUSH_IMAGES" = "true" ]; then
    docker push "${IMAGE_REGISTRY}/${image}:${IMAGE_TAG}"
  fi
}

push_image listings
push_image users
push_image tenants
push_image property
push_image inventory
push_image price
push_image platform

if [ "$BUMP_VERSION" = "true" ]; then
  next_patch=$((patch + 1))
  printf '%s.%s.%s\n' "$major" "$minor" "$next_patch" > "$VERSION_FILE"
  printf 'Built Docker images with tag %s under %s. Next build tag is %s.%s.%s.\n' "$IMAGE_TAG" "$IMAGE_REGISTRY" "$major" "$minor" "$next_patch"
else
  printf 'Built Docker images with tag %s under %s. Version file was not changed.\n' "$IMAGE_TAG" "$IMAGE_REGISTRY"
fi
