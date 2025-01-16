FROM node:18.17.1

WORKDIR /blog
COPY . .

RUN apt update -y && \
    apt install -y nginx && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN npm ci && \
    npm run clean && \
    npm run build

RUN rm -rf /var/www/html
RUN ln -s /blog/public /var/www/html


EXPOSE 80

ENTRYPOINT nginx -g "daemon off;"