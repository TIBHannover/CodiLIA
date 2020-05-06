FROM lsiobase/ubuntu:bionic

# set version label
ARG BUILD_DATE
ARG VERSION
ARG CODIMD_RELEASE
LABEL build_version="Linuxserver.io version:- ${VERSION} Build-date:- ${BUILD_DATE}"
LABEL maintainer="chbmb"

# environment settings
ARG DEBIAN_FRONTEND="noninteractive"
ENV NODE_ENV production

RUN echo "**** install build packages ****" && \
  apt-get update && \
  apt-get install -y \
          git \
          gnupg \
          jq \
          libssl-dev

RUN echo "**** install runtime *****" && \
  curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
  echo 'deb https://deb.nodesource.com/node_10.x bionic main' > /etc/apt/sources.list.d/nodesource.list

RUN echo "**** install yarn repository ****" && \
  curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list && \
  apt-get update && \
  apt-get install -y \
          fontconfig \
          fonts-noto \
          netcat-openbsd \
          nodejs \
          yarn && \
  echo "**** install codi-md ****" && \
  npm install -g webpack && \
  git clone https://github.com/liascript/codimd /opt/codimd && \
  cd /opt/codimd && \
  rm package-lock.json && \
  npm install \
  npm run build && \
  echo "**** cleanup ****" && \
  yarn cache clean && \
  apt-get -y purge \
          git \
          gnupg \
          jq \
          libssl-dev && \
 apt-get -y autoremove && \
 rm -rf \
          /tmp/* \
          /var/lib/apt/lists/* \
          /var/tmp/*

# add local files
#COPY root/ /

# ports and volumes
EXPOSE 3000
VOLUME /config
