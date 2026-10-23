# syntax=docker/dockerfile:1
# Stage 1: assemble the single-page app from src/
FROM node:22-alpine AS build
WORKDIR /src
COPY build.js ./
COPY src ./src
COPY server/public ./server/public
RUN node build.js --server-only

# Stage 2: the runtime (Node only, no npm packages). The server starts as root just long enough to hand
# /data to PUID:PGID, then switches to that user.
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    PUID=1000 \
    PGID=1000
WORKDIR /app
COPY server/package.json server/server.js ./
COPY --from=build /src/server/public ./public
RUN mkdir -p /data
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
LABEL org.opencontainers.image.title="Kiss Cut" \
      org.opencontainers.image.description="Turn logos and images into smooth, layered SVGs for Cricut vinyl, with shareable saved projects." \
      org.opencontainers.image.source="https://github.com/au12/kisscut"
CMD ["node", "server.js"]
