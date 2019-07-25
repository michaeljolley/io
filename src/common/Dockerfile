FROM node:12.6.0-alpine

ARG BUILDVERSION=0.0.0

WORKDIR /app

COPY ./package.json ./package-lock.json ./

RUN npm install

COPY ./ .

RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build
