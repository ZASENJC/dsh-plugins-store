FROM node:22.22.0-bookworm-slim

RUN npm install --global --ignore-scripts @deepseek-ai/dsh@0.1.0-rc.6 pnpm@11.19.0 \
    && npm cache clean --force \
    && mkdir -p /validator /validation/workspace /validation/home /validation/dsh-home \
    && chown -R node:node /validator /validation

COPY --chown=node:node validation/sandbox/copy-source.mjs /validator/copy-source.mjs
COPY --chown=node:node validation/sandbox/host-tool-smoke.mjs /validator/host-tool-smoke.mjs
COPY --chown=node:node validation/sandbox/postflight.mjs /validator/postflight.mjs

USER node
WORKDIR /validation/workspace/plugin
