FROM node:26-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy app files
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
