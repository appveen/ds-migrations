FROM node:18-alpine

RUN apk update
RUN apk upgrade

WORKDIR /tmp/app

COPY package.json package.json

RUN npm install --no-audit

RUN mkdir -p keys
RUN mkdir -p roles
RUN mkdir -p scripts

COPY . .

RUN chmod 777 /tmp/app

ENV NODE_ENV="production"

EXPOSE 3000

CMD [ "node", "app.js" ]