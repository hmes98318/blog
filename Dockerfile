FROM node:18.17.1

WORKDIR /blog

RUN apt update -y
RUN apt install git -y

ENTRYPOINT git pull && npm run server