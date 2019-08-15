FROM node:12.6.0-alpine

WORKDIR /app/shared

COPY ./shared/package*.json ./
RUN npm ci --silent

COPY ./shared/ ./
RUN npm version $BUILDVERSION --allow-same-version \
    && npm run build

WORKDIR /app/webhooks

COPY ./webhooks/package*.json ./
RUN npm ci --silent

COPY ./webhooks/ ./
RUN npm version $BUILDVERSION --allow-same-version \
    && npm run build

EXPOSE 80
CMD [ "npm", "start" ]