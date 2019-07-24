FROM node:12.6.0-alpine AS build

ARG BUILDVERSION=0.0.0

# The base path of /app will be used in other services. We
# want shared to be a sibling of each app for build purposes.
WORKDIR /app/shared

# Copy dependency files
COPY ./package.json ./package-lock.json ./

# Clean install depdenencies
RUN npm ci --silent

# ^^^^
# All layers above are cached, the below layers change more often
# vvvv

# Copy user application code
COPY ./ .

# Build typescript files
RUN npm version $BUILDVERSION --allow-same-version;
RUN npm run build
