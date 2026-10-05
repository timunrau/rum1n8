FROM node:26-alpine AS builder

# The pinned voice model is a .tar.bz2 archive. Busybox tar in Alpine cannot
# read bzip2, so the extraction step in scripts/prepare-voice-model.mjs needs
# GNU tar and bzip2 present.
RUN apk add --no-cache tar bzip2

WORKDIR /workspace
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_CLIENT_SECRET
ARG VITE_UMAMI_SCRIPT_URL
ARG VITE_UMAMI_WEBSITE_ID
ARG VITE_APP_URL
ARG VITE_MARKETING_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_GOOGLE_CLIENT_SECRET=$VITE_GOOGLE_CLIENT_SECRET \
    VITE_UMAMI_SCRIPT_URL=$VITE_UMAMI_SCRIPT_URL \
    VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_MARKETING_URL=$VITE_MARKETING_URL

# The ~167 MB model archive is cached in a BuildKit cache mount rather than in
# the image layer, so a failed or repeated build does not refetch it. The mount
# is not part of the build context, so it cannot leak into `COPY . .`.
RUN --mount=type=cache,target=/workspace/.cache/voice-model \
    npm run build:app \
    && node scripts/render-app-nginx.mjs nginx.app.conf.template /tmp/default.conf \
    && node scripts/verify-voice-model.mjs dist-app \
    && test -f dist-app/app/index.html \
    && test -f dist-app/sw.js \
    && test -f dist-app/manifest.webmanifest \
    && test ! -e dist-app/index.html \
    && test ! -e dist-app/privacy/index.html \
    && test ! -e dist-app/voice-model/sherpa-en-v1.13.7/index.html \
    && test ! -e dist-app/voice-model/sherpa-en-v1.13.7/app-asr.js

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /workspace/dist-app/ /usr/share/nginx/html/
COPY --from=builder /tmp/default.conf /etc/nginx/conf.d/default.conf
RUN nginx -t

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
