FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY worker ./worker
COPY runtime ./runtime
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]

