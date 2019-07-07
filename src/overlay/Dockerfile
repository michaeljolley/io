FROM node AS build

ARG BUILDVERSION=0.0.0

WORKDIR /app

COPY ./src/overlay/package.json .
COPY ./src/common/package.json ./src
RUN npm install

COPY ./src/overlay .
COPY ./src/common ./src

RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

EXPOSE 80

CMD [ "npm", "start"]
