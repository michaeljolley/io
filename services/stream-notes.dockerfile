FROM node:12.6.0-alpine

RUN apk --no-cache add git

WORKDIR /app/shared

COPY ./shared/package*.json ./
RUN npm ci --silent

COPY ./shared/ ./
RUN npm version $BUILDVERSION --allow-same-version \
    && npm run build

WORKDIR /app/stream-notes

COPY ./stream-notes/package*.json ./
RUN npm ci --silent

COPY ./stream-notes/ ./
RUN npm version $BUILDVERSION --allow-same-version \
    && npm run build

EXPOSE 80
CMD [ "npm", "start" ]
