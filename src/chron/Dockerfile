FROM node:12.6.0-alpine

ARG BUILDVERSION=0.0.0

WORKDIR /app

# Copy chron dependency files
COPY ./src/chron/package.json ./src/chron/package-lock.json ./

# Clean install chron dependencies
RUN npm ci --silent

# Copy common dependency files
COPY ./src/common/package.json ./src/common/package-lock.json ./src/

# Clean install common dependencies
WORKDIR /app/src
RUN npm ci --silent
WORKDIR /app

# ^^^^
# All layers above are cached, the below layers change more often
# vvvv

# Copy chron application code
COPY ./src/chron .

# Copy common dependency files
COPY ./src/common ./src

# Build typescript files
RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

EXPOSE 80

CMD [ "npm", "start"]
