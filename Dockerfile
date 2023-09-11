FROM node:18.17.1

WORKDIR /blog
COPY . .

RUN apt update -y
RUN apt install git -y

RUN npm install

RUN chmod +x ./entrypoint.sh

CMD ["./entrypoint.sh"]