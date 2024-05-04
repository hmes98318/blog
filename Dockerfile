FROM node:18.17.1

WORKDIR /blog

RUN apt update -y && \
    apt install -y \
    git \
    nginx && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN git pull
RUN npm install

RUN rm -rf /var/www/html
RUN ln -s /blog/public /var/www/html

EXPOSE 80

ENTRYPOINT git pull && npm run clean && npm run build && nginx -g "daemon off;"