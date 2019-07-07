FROM node AS build

ARG BUILDVERSION=0.0.0

WORKDIR /app

COPY ./src/hub .
COPY ./src/common ./src

RUN npm install

RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

EXPOSE 80

CMD [ "npm", "start"]
