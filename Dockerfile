FROM node:18.17.1

WORKDIR /blog

RUN apt update -y
RUN apt install git -y
RUN apt install nginx -y

RUN rm -rf /var/www/html
RUN ln -s /blog/public /var/www/html

EXPOSE 80

ENTRYPOINT git pull && npm run clean && npm run build && nginx -g "daemon off;"