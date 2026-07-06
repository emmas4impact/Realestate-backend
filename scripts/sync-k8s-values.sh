#!/usr/bin/env sh
set -eu

VERSION_FILE="${VERSION_FILE:-IMAGE_VERSION}"
RELEASE_FILE="${RELEASE_FILE:-RELEASE_NAME}"
VALUES_DIR="${VALUES_DIR:-microservices/Values}"

get_tag() {
  key="$1"
  awk -F= -v key="$key" '$1 == key { print $2 }' "$VERSION_FILE" | tail -n 1 | tr -d '[:space:]'
}

set_app_version() {
  file="$1"
  version="$2"
  tmp_file="${file}.tmp"
  awk -v version="$version" '
    /^appVersion:/ { print "appVersion: \"" version "\""; next }
    { print }
  ' "$file" > "$tmp_file"
  mv "$tmp_file" "$file"
}

set_env_value() {
  file="$1"
  name="$2"
  value="$3"
  tmp_file="${file}.tmp"
  awk -v name="$name" -v value="$value" '
    $0 ~ "^- name: " name "$" { print; found=1; next }
    found == 1 && $0 ~ /^  value:/ { print "  value: \"" value "\""; found=0; next }
    found == 1 && $0 ~ /^- name:/ { found=0 }
    { print }
  ' "$file" > "$tmp_file"
  mv "$tmp_file" "$file"
}

require_file() {
  file="$1"
  if [ ! -f "$file" ]; then
    printf 'Missing expected values file: %s\n' "$file" >&2
    exit 1
  fi
}

listings_tag="$(get_tag LISTINGS_IMAGE_TAG)"
users_tag="$(get_tag USERS_IMAGE_TAG)"
tenants_tag="$(get_tag TENANTS_IMAGE_TAG)"
property_tag="$(get_tag PROPERTY_IMAGE_TAG)"
inventory_tag="$(get_tag INVENTORY_IMAGE_TAG)"
price_tag="$(get_tag PRICE_IMAGE_TAG)"
platform_tag="$(get_tag PLATFORM_IMAGE_TAG)"
search_tag="$(get_tag SEARCH_IMAGE_TAG)"
release_name="$(if [ -f "$RELEASE_FILE" ]; then sed -n '1p' "$RELEASE_FILE"; fi)"

require_file "$VALUES_DIR/listing-service-values.yaml"
require_file "$VALUES_DIR/users-service-values.yaml"
require_file "$VALUES_DIR/tenant-service-values.yaml"
require_file "$VALUES_DIR/property-service-values.yaml"
require_file "$VALUES_DIR/inventory-service-values.yaml"
require_file "$VALUES_DIR/price-service-values.yaml"
require_file "$VALUES_DIR/platform-service-values.yaml"
require_file "$VALUES_DIR/search-service-values.yaml"

set_app_version "$VALUES_DIR/listing-service-values.yaml" "$listings_tag"
set_app_version "$VALUES_DIR/users-service-values.yaml" "$users_tag"
set_app_version "$VALUES_DIR/tenant-service-values.yaml" "$tenants_tag"
set_app_version "$VALUES_DIR/property-service-values.yaml" "$property_tag"
set_app_version "$VALUES_DIR/inventory-service-values.yaml" "$inventory_tag"
set_app_version "$VALUES_DIR/price-service-values.yaml" "$price_tag"
set_app_version "$VALUES_DIR/platform-service-values.yaml" "$platform_tag"
set_app_version "$VALUES_DIR/search-service-values.yaml" "$search_tag"

if [ -n "$release_name" ]; then
  set_env_value "$VALUES_DIR/platform-service-values.yaml" RELEASE_NAME "$release_name"
fi
set_env_value "$VALUES_DIR/platform-service-values.yaml" LISTINGS_IMAGE_TAG "$listings_tag"
set_env_value "$VALUES_DIR/platform-service-values.yaml" USERS_IMAGE_TAG "$users_tag"
set_env_value "$VALUES_DIR/platform-service-values.yaml" TENANTS_IMAGE_TAG "$tenants_tag"
set_env_value "$VALUES_DIR/platform-service-values.yaml" PROPERTY_IMAGE_TAG "$property_tag"
set_env_value "$VALUES_DIR/platform-service-values.yaml" INVENTORY_IMAGE_TAG "$inventory_tag"
set_env_value "$VALUES_DIR/platform-service-values.yaml" PRICE_IMAGE_TAG "$price_tag"
set_env_value "$VALUES_DIR/platform-service-values.yaml" PLATFORM_IMAGE_TAG "$platform_tag"
set_env_value "$VALUES_DIR/platform-service-values.yaml" SEARCH_IMAGE_TAG "$search_tag"

printf 'Synced Kubernetes values from %s.\n' "$VERSION_FILE"
