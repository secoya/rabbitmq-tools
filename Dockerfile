# Build image
FROM node:10
WORKDIR /library

COPY package.json yarn.lock /library/
RUN yarn install --frozen-lockfile

COPY tsconfig.json tslint.json /library/
COPY types/ /library/types/
COPY src/ /library/src/
RUN node_modules/.bin/tslint -p tsconfig.json
RUN node_modules/.bin/tsc -p tsconfig.json

VOLUME /artifacts/
CMD cp -r /library/dist/* /artifacts/dist && chown -R $USER_ID:$GROUP_ID /artifacts/
