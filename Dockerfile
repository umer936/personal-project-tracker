# syntax=docker/dockerfile:1

# Rhythm planner — PHP rewrite served by FrankenPHP (a single, self-contained
# PHP application server built on Caddy). No build step: PHP is interpreted,
# and styling uses the Tailwind Play CDN, so the image is just the source.
FROM dunglas/frankenphp:1-php8.3

# FrankenPHP serves /app/public by default; our Caddyfile makes that explicit
# and adds front-controller routing.
WORKDIR /app

# Copy the application source (public web root + src includes).
COPY php/ /app/

# Our custom server config (front-controller routing, gzip, port 80).
COPY php/Caddyfile /etc/frankenphp/Caddyfile

# Per-user JSON data lives here and must be writable + persisted (see the
# named volume in docker-compose.yml). Seed the folder so it exists on boot.
RUN mkdir -p /app/data/stores \
    && chown -R www-data:www-data /app/data

EXPOSE 80
