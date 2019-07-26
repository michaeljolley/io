FROM node:12.6.0-alpine as build

ARG BUILDVERSION=0.0.0

WORKDIR /app

WORKDIR /app/shared

# Copy dependency files
COPY ./package.json ./package-lock.json ./

# Clean install depdenencies
RUN npm ci --silent

# ^^^^
# All layers above are cached, the below layers change more often
# vvvv

COPY ./ .
