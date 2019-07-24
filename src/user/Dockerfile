FROM  io/shared as build

ARG BUILDVERSION=0.0.0

WORKDIR /app

# Copy user dependency files
COPY ./src/user/package.json ./src/user/package-lock.json ./

# Clean install user depdenencies
RUN npm ci --silent

# Copy common dependency files
WORKDIR /app/src
COPY ./src/common/package.json ./src/common/package-lock.json ./

# Clean install common depdenencies
RUN npm ci --silent
WORKDIR /app

# ^^^^
# All layers above are cached, the below layers change more often
# vvvv

# Copy user application code
COPY ./src/user .

# Copy common application code
COPY ./src/common ./src

# Build typescript files
RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build

# Put together the release image with the just build artifacts
FROM node:12.6.0-alpine

WORKDIR /app

# Copy dependency files
COPY ./package.json ./package-lock.json ./

# Clean install production-only depdenencies
RUN npm ci --silent --only=production

WORKDIR /app/dist

COPY --from=build /app/dist .

WORKDIR /app

EXPOSE 80

CMD [ "npm", "start"]
