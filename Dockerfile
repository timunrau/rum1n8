# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept Google Drive OAuth credentials as build args
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_CLIENT_SECRET

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install tools for health checks and runtime metadata rendering
RUN apk add --no-cache gettext wget

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-runtime-site-metadata.sh /docker-entrypoint.d/40-runtime-site-metadata.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-site-metadata.sh

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
