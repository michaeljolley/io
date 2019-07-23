FROM node:12.6.0-alpine

ARG BUILDVERSION=0.0.0

WORKDIR /app

# Copy webhooks dependency files
COPY ./src/webhooks/package.json ./src/webhooks/package-lock.json ./

# Clean install webhook depdenencies
RUN npm ci --silent

# Copy common dependency files
COPY ./src/common/package.json ./src/common/package-lock.json ./

# Clean install common depdenencies
WORKDIR /app/src
RUN npm ci --silent
WORKDIR /app

# ^^^^
# All layers above are cached, the below layers change more often
# vvvv

# Copy webhooks application code
COPY ./src/webhooks .

# Copy common application code
COPY ./src/common ./src

# Build typescript files
RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

EXPOSE 80

CMD [ "npm", "start"]
