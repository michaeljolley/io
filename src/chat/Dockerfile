FROM node:12.6.0-alpine

ARG BUILDVERSION=0.0.0

WORKDIR /app

# Copy chat dependency files
COPY ./src/chat/package.json ./src/chat/package-lock.json ./

# Clean install chat dependencies
RUN npm ci --silent

# Copy common dependency files
WORKDIR /app/src
COPY ./src/common/package.json ./src/common/package-lock.json ./

# Clean install common dependencies
RUN npm ci --silent
WORKDIR /app

# ^^^^
# All layers above are cached, the below layers change more often
# vvvv

# Copy chat application code
COPY ./src/chat .

# Copy common application code
COPY ./src/common ./src

# Build typescript files
RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

EXPOSE 80

CMD [ "npm", "start"]
