# FROM node:22-alpine

# WORKDIR /app

# COPY package.json .

# RUN npm install pnpm -g --ignore-scripts

# RUN pnpm install --ignore-scripts

# COPY . .

# RUN DATABASE_URL=$DATABASE_URL pnpm run build

# EXPOSE 3000

# CMD ["pnpm", "run", "start"]


FROM node:23-slim

# Install OpenSSL 1.1
RUN apk add --no-cache openssl1.1

# Set working dir
WORKDIR /app

COPY . .

# Install deps & build
RUN npm install
RUN npm run build

CMD ["node", "dist/app.js"]
