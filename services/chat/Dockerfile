FROM io-shared as build

ARG BUILDVERSION=0.0.0

WORKDIR /app/chat

# Copy dependency files
COPY ./package.json ./

# Clean install depdenencies
RUN npm i --silent \
  && npm link ../shared/dist

# ^^^^
# All layers above are cached, the below layers change more often
# vvvv

# Copy application code
COPY ./ .

# Build typescript files
RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

# Put together the release image with the just build artifacts
FROM node:12.6.0-alpine

WORKDIR /app/shared/dist

# Copy shared dependencies
COPY --from=build /app/shared/dist ./

WORKDIR /app/chat

# Copy dependency files
COPY --from=build /app/chat/package*.json ./

# Clean install production-only depdenencies
RUN npm ci --silent --only=production \
  && npm link ../shared/dist

COPY --from=build /app/chat/dist ./chat/dist

EXPOSE 80

CMD [ "node", "dist/index.js" ]
