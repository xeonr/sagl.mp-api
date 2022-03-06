FROM node:14

WORKDIR /usr/src/app

ARG NPM_TOKEN
COPY .npmrc-ci .npmrc
COPY package.json package.json
RUN npm install
RUN rm -f .npmrc
RUN npm run build

COPY . .
CMD npm run production
