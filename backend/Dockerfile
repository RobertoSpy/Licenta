FROM node:22-alpine

RUN apk add --no-cache \
    bash \
    libc6-compat \
    openssl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/src/index.js"]