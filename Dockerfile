# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the app
COPY . .

EXPOSE 3003

CMD ["npm", "run", "dev"]
