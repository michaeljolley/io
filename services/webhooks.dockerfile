FROM node:12.6.0-slim

WORKDIR /app/shared

COPY ./shared/package*.json ./
RUN npm ci --silent

COPY ./shared/ ./
RUN npm version $BUILDVERSION --allow-same-version \
  && npm run build

WORKDIR /app/webhooks

COPY ./webhooks/package*.json ./
RUN npm ci --silent

COPY ./webhooks/.ngrok2/ngrok.yml /root/.ngrok2/

COPY ./webhooks/ ./
RUN npm version $BUILDVERSION --allow-same-version \
  && npm run build \
  && rm -rf .ngrok2

EXPOSE 80
CMD [ "node", "dist/index.js" ]
