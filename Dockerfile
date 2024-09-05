FROM node:20
ARG MAXMIND_APIKEY
WORKDIR /usr/src/app

ARG NPM_TOKEN
COPY .npmrc-ci .npmrc
COPY package.json package.json
RUN npm install
RUN rm -f .npmrc

COPY . .
RUN npm run build

RUN mkdir -p db
RUN curl -sfSL "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&suffix=tar.gz&license_key=${MAXMIND_APIKEY}" | tar -xz && \
	curl -sfSL "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN&suffix=tar.gz&license_key=${MAXMIND_APIKEY}" | tar -xz && \
	mv GeoLite2-City_*/GeoLite2-City.mmdb db/ && \
	mv GeoLite2-ASN_*/GeoLite2-ASN.mmdb db/

CMD npm run production
