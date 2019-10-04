FROM node:12.6.0-alpine as build

ARG BUILDVERSION=0.0.0

WORKDIR /app/shared

# Copy dependency files
COPY ./package.json ./

# Clean install depdenencies
RUN npm i --silent

# ^^^^
# All layers above are cached, the below layers change more often
# vvvv

COPY ./ .

RUN npm run build

FROM node:12.6.0-alpine

WORKDIR /app/shared/dist

COPY --from=build /app/shared/dist ./
