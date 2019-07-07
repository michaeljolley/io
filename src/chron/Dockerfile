FROM node AS build

ARG BUILDVERSION=0.0.0

WORKDIR /app

COPY ./src/chron .
COPY ./src/common ./src

WORKDIR /app/src

RUN npm install

WORKDIR /app

RUN npm install

RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

EXPOSE 80

CMD [ "npm", "start"]
