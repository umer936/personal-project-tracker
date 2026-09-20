# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the app and build for production
COPY . .
RUN npm run build

EXPOSE 3003

# Run the compiled production server (no Turbopack HMR = stable)
CMD ["npm", "run", "start"]
