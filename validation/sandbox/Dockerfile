FROM node:22.22.0-bookworm-slim

COPY validation/sandbox/toolchain/package.json validation/sandbox/toolchain/package-lock.json /validator/toolchain/
RUN npm ci --prefix /validator/toolchain --omit=dev --ignore-scripts \
    && npm cache clean --force \
    && mkdir -p /validator /validation/workspace /validation/home /validation/dsh-home \
    && chown -R node:node /validator /validation

ENV PATH="/validator/toolchain/node_modules/.bin:${PATH}"

COPY --chown=node:node validation/sandbox/copy-source.mjs /validator/copy-source.mjs
COPY --chown=node:node validation/sandbox/capability-stub.mjs /validator/capability-stub.mjs
COPY --chown=node:node validation/sandbox/host-tool-smoke.mjs /validator/host-tool-smoke.mjs
COPY --chown=node:node validation/sandbox/postflight.mjs /validator/postflight.mjs

USER node
WORKDIR /validation/workspace/plugin
