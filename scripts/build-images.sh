#!/usr/bin/env sh
set -eu

VERSION_FILE="${VERSION_FILE:-IMAGE_VERSION}"
RELEASE_FILE="${RELEASE_FILE:-RELEASE_NAME}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-realestate}"
PUSH_IMAGES="${PUSH_IMAGES:-false}"
BUILD_ALL="${BUILD_ALL:-false}"
DRY_RUN="${DRY_RUN:-false}"
CHANGED_SINCE="${CHANGED_SINCE:-HEAD}"
MANUAL_TAG="${1:-}"

SERVICES_LIST="listings users tenants property inventory price platform search"

pick_word() {
  seed="$1"
  shift
  count="$#"
  index=$((seed % count + 1))
  eval "printf '%s' \"\${$index}\""
}

generate_release_name() {
  seed="$(date +%s)"
  seed=$((seed + $$))
  adjective="$(pick_word "$seed" amused bashful bewildered brave bubbly clumsy curious dizzy eager embarrassed fancy fizzy gentle giggly heroic jolly lucky mellow nimble quirky radiant sleepy spicy sturdy velvet wobbly zesty)"
  noun="$(pick_word "$((seed / 3 + 7))" blueprint bungalow compass doorknob elevator fireplace gazebo hammock lantern marble meadow painting patio pebble penthouse pickle postcard sofa staircase teacup terrace toolbox umbrella veranda)"
  printf '%s %s' "$adjective" "$noun"
}

tag_var_for_service() {
  printf '%s_IMAGE_TAG' "$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')"
}

validate_semver() {
  value="$1"
  major="$(printf '%s' "$value" | cut -d . -f 1)"
  minor="$(printf '%s' "$value" | cut -d . -f 2)"
  patch="$(printf '%s' "$value" | cut -d . -f 3)"
  extra="$(printf '%s' "$value" | cut -d . -f 4)"

  case "$major:$minor:$patch:$extra" in
    *[!0-9:]* | ::* | *::* | *:::*)
      return 1
      ;;
  esac

  [ -z "$extra" ] && [ -n "$major" ] && [ -n "$minor" ] && [ -n "$patch" ]
}

bump_patch() {
  value="$1"
  if [ "$value" = "0.9.9" ]; then
    printf '1.0.0'
    return
  fi
  major="$(printf '%s' "$value" | cut -d . -f 1)"
  minor="$(printf '%s' "$value" | cut -d . -f 2)"
  patch="$(printf '%s' "$value" | cut -d . -f 3)"
  printf '%s.%s.%s' "$major" "$minor" "$((patch + 1))"
}

contains_service() {
  needle="$1"
  haystack="$2"
  for item in $haystack; do
    if [ "$item" = "$needle" ]; then
      return 0
    fi
  done
  return 1
}

append_service() {
  service="$1"
  current="$2"
  if contains_service "$service" "$current"; then
    printf '%s' "$current"
  elif [ -z "$current" ]; then
    printf '%s' "$service"
  else
    printf '%s %s' "$current" "$service"
  fi
}

all_services() {
  printf '%s' "$SERVICES_LIST"
}

normalize_version_file() {
  if [ ! -f "$VERSION_FILE" ]; then
    for service in $SERVICES_LIST; do
      printf '%s=0.9.9\n' "$(tag_var_for_service "$service")"
    done > "$VERSION_FILE"
    return
  fi

  first_line="$(sed -n '1p' "$VERSION_FILE" | tr -d '[:space:]')"
  case "$first_line" in
    *=*)
      return
      ;;
  esac

  if ! validate_semver "$first_line"; then
    printf 'Invalid %s value "%s". Use semantic versions like 1.0.0 or per-service KEY=value lines.\n' "$VERSION_FILE" "$first_line" >&2
    exit 1
  fi

  for service in $SERVICES_LIST; do
    printf '%s=%s\n' "$(tag_var_for_service "$service")" "$first_line"
  done > "$VERSION_FILE"
}

get_service_tag() {
  service="$1"
  var_name="$(tag_var_for_service "$service")"
  value="$(awk -F= -v key="$var_name" '$1 == key { print $2 }' "$VERSION_FILE" | tail -n 1 | tr -d '[:space:]')"

  if [ -z "$value" ]; then
    value="0.9.9"
  fi

  if ! validate_semver "$value"; then
    printf 'Invalid %s for %s in %s. Use semantic version format like 1.0.0.\n' "$value" "$var_name" "$VERSION_FILE" >&2
    exit 1
  fi

  printf '%s' "$value"
}

write_version_file() {
  built_services="$1"
  tmp_file="${VERSION_FILE}.tmp"

  for service in $SERVICES_LIST; do
    current_tag="$(get_service_tag "$service")"
    if [ -n "$MANUAL_TAG" ]; then
      if contains_service "$service" "$built_services"; then
        current_tag="$MANUAL_TAG"
      fi
    elif contains_service "$service" "$built_services"; then
      current_tag="$(bump_patch "$current_tag")"
    fi
    printf '%s=%s\n' "$(tag_var_for_service "$service")" "$current_tag"
  done > "$tmp_file"

  mv "$tmp_file" "$VERSION_FILE"
}

detect_changed_services() {
  selected=""
  changed_files="$(git diff --name-only "$CHANGED_SINCE" 2>/dev/null || true)
$(git ls-files --others --exclude-standard 2>/dev/null || true)"

  for file in $changed_files; do
    case "$file" in
      services/listings/*)
        selected="$(append_service listings "$selected")"
        ;;
      services/users/*)
        selected="$(append_service users "$selected")"
        ;;
      services/tenants/*)
        selected="$(append_service tenants "$selected")"
        ;;
      services/property/*)
        selected="$(append_service property "$selected")"
        ;;
      services/inventory/*)
        selected="$(append_service inventory "$selected")"
        ;;
      services/price/*)
        selected="$(append_service price "$selected")"
        ;;
      services/platform/*)
        selected="$(append_service platform "$selected")"
        ;;
      services/search/*)
        selected="$(append_service search "$selected")"
        ;;
      packages/shared/* | package.json | package-lock.json | Dockerfile)
        selected="$(all_services)"
        ;;
    esac
  done

  printf '%s' "$selected"
}

normalize_version_file

if [ -n "$MANUAL_TAG" ] && ! validate_semver "$MANUAL_TAG"; then
  printf 'Invalid manual tag "%s". Use semantic version format like 1.0.0.\n' "$MANUAL_TAG" >&2
  exit 1
fi

if [ "${SERVICES:-}" ]; then
  selected_services=""
  for service in $SERVICES; do
    if ! contains_service "$service" "$SERVICES_LIST"; then
      printf 'Unknown service "%s". Valid services: %s\n' "$service" "$SERVICES_LIST" >&2
      exit 1
    fi
    selected_services="$(append_service "$service" "$selected_services")"
  done
elif [ "$BUILD_ALL" = "true" ] || [ -n "$MANUAL_TAG" ]; then
  selected_services="$(all_services)"
else
  selected_services="$(detect_changed_services)"
fi

if [ -z "$selected_services" ]; then
  printf 'No service changes detected since %s. Nothing to build.\n' "$CHANGED_SINCE"
  exit 0
fi

export IMAGE_REGISTRY

compose_services=""
for service in $selected_services; do
  var_name="$(tag_var_for_service "$service")"
  if [ -n "$MANUAL_TAG" ]; then
    tag="$MANUAL_TAG"
  else
    tag="$(bump_patch "$(get_service_tag "$service")")"
  fi
  export "$var_name=$tag"
  compose_services="$compose_services ${service}-service"
  printf 'Will build %s as %s/%s:%s\n' "${service}-service" "$IMAGE_REGISTRY" "$service" "$tag"
done

if [ "$DRY_RUN" = "true" ]; then
  printf 'Dry run only. Version file was not changed.\n'
  exit 0
fi

backup_file="${VERSION_FILE}.bak.$$"
release_backup_file="${RELEASE_FILE}.bak.$$"
cp "$VERSION_FILE" "$backup_file"
if [ -f "$RELEASE_FILE" ]; then
  cp "$RELEASE_FILE" "$release_backup_file"
else
  : > "$release_backup_file"
fi
write_version_file "$selected_services"
release_name="${RELEASE_NAME:-$(generate_release_name)}"
printf '%s\n' "$release_name" > "$RELEASE_FILE"
printf 'Release name: %s\n' "$release_name"

if ! docker compose --env-file .env --env-file "$VERSION_FILE" build $compose_services; then
  mv "$backup_file" "$VERSION_FILE"
  if [ -s "$release_backup_file" ]; then
    mv "$release_backup_file" "$RELEASE_FILE"
  else
    rm -f "$RELEASE_FILE" "$release_backup_file"
  fi
  printf 'Docker build failed. Restored %s.\n' "$VERSION_FILE" >&2
  exit 1
fi

rm -f "$backup_file"
rm -f "$release_backup_file"

for service in $selected_services; do
  var_name="$(tag_var_for_service "$service")"
  tag="$(eval "printf '%s' \"\${$var_name}\"")"
  if [ "$PUSH_IMAGES" = "true" ]; then
    docker push "${IMAGE_REGISTRY}/${service}:${tag}"
  fi
done

printf 'Built Docker images under %s. Updated built tags in %s for: %s\n' "$IMAGE_REGISTRY" "$VERSION_FILE" "$selected_services"
