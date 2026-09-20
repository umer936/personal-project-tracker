# syntax=docker/dockerfile:1

# This project builds to a *static* site (see next.config.ts: output "export").
# Docker is entirely optional — you can just upload the ./out folder to any host.
# This image is a convenience: it builds the static site and serves it with nginx.

# Stage 1 — build the static export (./out)
FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — serve the static files
FROM nginx:alpine
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
