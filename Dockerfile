# Build stage
FROM node:21-alpine3.18 as builder
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache --virtual .gyp python3 make g++ && apk add --no-cache git && npm install && apk del .gyp
COPY . .
RUN npm run build

# Production stage
FROM node:21-alpine3.18 as deploy
WORKDIR /app
ARG PORT=3008
ENV PORT=$PORT
EXPOSE $PORT
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm cache clean --force && npm install --omit=dev --ignore-scripts && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs && rm -rf /root/.npm /root/.node-gyp
CMD ["npm", "start"]