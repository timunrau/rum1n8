# Build stage
FROM node:24-alpine AS builder

WORKDIR /workspace

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept Google Drive OAuth credentials as build args
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_CLIENT_SECRET

# Accept optional Umami analytics configuration as build args
ARG VITE_UMAMI_SCRIPT_URL
ARG VITE_UMAMI_WEBSITE_ID

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install tools for health checks and runtime metadata rendering
RUN apk add --no-cache gettext wget

# Copy built files from builder stage
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /workspace/dist/ /usr/share/nginx/html/
RUN test -f /usr/share/nginx/html/index.html \
  && ! grep -q "Welcome to nginx" /usr/share/nginx/html/index.html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-runtime-site-metadata.sh /docker-entrypoint.d/40-runtime-site-metadata.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-site-metadata.sh

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
