FROM node AS build

ARG BUILDVERSION=0.0.0

WORKDIR /app

COPY ./src/chat .
COPY ./src/common ./src
COPY .env .

RUN npm install

RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

EXPOSE 80

CMD [ "npm", "start"]
