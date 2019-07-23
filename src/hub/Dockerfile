FROM node:12.6.0-alpine

ARG BUILDVERSION=0.0.0

WORKDIR /app

# Copy hub dependency files
COPY ./src/hub/package.json ./src/hub/package-lock.json ./

# Clean install hub dependencies
RUN npm ci --silent

# Copy common dependencies
COPY ./src/common/package.json ./src/common/package-lock.json ./src/

# Clean install common dependencies
WORKDIR /app/src
RUN npm ci --silent
WORKDIR /app

# ^^^^
# All layers above are cached, the below layers change more often
# vvvv

# Copy hub application code
COPY ./src/hub .

# Copy common application code
COPY ./src/common ./src

# Build typescript files
RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

EXPOSE 80

CMD [ "npm", "start"]
