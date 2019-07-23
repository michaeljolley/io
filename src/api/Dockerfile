FROM node:12.6.0-alpine

ARG BUILDVERSION=0.0.0

WORKDIR /app

# Copy api dependency files
COPY ./src/api/package.json ./src/api/package-lock.json ./

# Clean install api dependencies
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

# Copy api application code
COPY ./src/api .

# Copy common application code
COPY ./src/common ./src

# Build typescript files
RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

EXPOSE 80

CMD [ "npm", "start"]
