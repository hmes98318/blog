FROM node:24.21.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --global npm@12.2.0 && npm ci

COPY . .
RUN npm run build

FROM nginx:stable-alpine-slim

COPY --from=build /app/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
