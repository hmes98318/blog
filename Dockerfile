FROM node:22.15.0-slim AS node_build

WORKDIR /app

COPY . .

RUN npm ci && \
    npm run clean && \
    npm run build


############################################################

FROM nginx:stable-alpine-slim

COPY --from=node_build /app/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]