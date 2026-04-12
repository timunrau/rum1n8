#!/bin/sh
set -eu

HTML_ROOT="/usr/share/nginx/html"
INDEX_TEMPLATE="${HTML_ROOT}/index.html.template"
ROBOTS_TEMPLATE="${HTML_ROOT}/robots.txt.template"
SITEMAP_TEMPLATE="${HTML_ROOT}/sitemap.xml.template"

normalize_site_url() {
  value="${1:-}"

  while [ -n "$value" ] && [ "${value%/}" != "$value" ]; do
    value="${value%/}"
  done

  printf '%s' "$value"
}

SITE_URL="$(normalize_site_url "${VITE_SITE_URL:-}")"

case "$SITE_URL" in
  '')
    ;;
  http://*|https://*)
    ;;
  *)
    echo >&2 "rum1n8: ignoring VITE_SITE_URL because it is not an absolute http(s) URL: $SITE_URL"
    SITE_URL=""
    ;;
esac

RUM1N8_SOCIAL_IMAGE_URL="/marketing/og-card.png"
RUM1N8_OPTIONAL_SITE_URL_TAGS=""
RUM1N8_JSON_LD_URL_FIELDS=""
RUM1N8_SITEMAP_LINE=""
RUM1N8_ROOT_URL=""

if [ -n "$SITE_URL" ]; then
  RUM1N8_ROOT_URL="${SITE_URL}/"
  RUM1N8_SOCIAL_IMAGE_URL="${SITE_URL}/marketing/og-card.png"
  RUM1N8_OPTIONAL_SITE_URL_TAGS="$(cat <<EOF
<link rel="canonical" href="${RUM1N8_ROOT_URL}" />
    <meta property="og:url" content="${RUM1N8_ROOT_URL}" />
EOF
)"
  RUM1N8_JSON_LD_URL_FIELDS="$(cat <<EOF
,"url":"${RUM1N8_ROOT_URL}","image":"${RUM1N8_SOCIAL_IMAGE_URL}","screenshot":["${SITE_URL}/marketing/screenshot-empty.png","${SITE_URL}/marketing/screenshot-practice.png","${SITE_URL}/marketing/screenshot-review.png"]
EOF
)"
  RUM1N8_SITEMAP_LINE="Sitemap: ${SITE_URL}/sitemap.xml"
fi

export RUM1N8_SOCIAL_IMAGE_URL
export RUM1N8_OPTIONAL_SITE_URL_TAGS
export RUM1N8_JSON_LD_URL_FIELDS
export RUM1N8_SITEMAP_LINE
export RUM1N8_ROOT_URL

if [ -f "$INDEX_TEMPLATE" ]; then
  envsubst '${RUM1N8_SOCIAL_IMAGE_URL} ${RUM1N8_OPTIONAL_SITE_URL_TAGS} ${RUM1N8_JSON_LD_URL_FIELDS}' \
    < "$INDEX_TEMPLATE" \
    > "${HTML_ROOT}/index.html"
fi

if [ -f "$ROBOTS_TEMPLATE" ]; then
  envsubst '${RUM1N8_SITEMAP_LINE}' \
    < "$ROBOTS_TEMPLATE" \
    > "${HTML_ROOT}/robots.txt"
fi

if [ -n "$RUM1N8_ROOT_URL" ] && [ -f "$SITEMAP_TEMPLATE" ]; then
  envsubst '${RUM1N8_ROOT_URL}' \
    < "$SITEMAP_TEMPLATE" \
    > "${HTML_ROOT}/sitemap.xml"
else
  rm -f "${HTML_ROOT}/sitemap.xml"
fi

if [ -n "$SITE_URL" ]; then
  echo "rum1n8: rendered runtime site metadata for ${SITE_URL}"
else
  echo "rum1n8: rendered generic site metadata (VITE_SITE_URL unset)"
fi
