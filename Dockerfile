FROM node:20-slim

WORKDIR /app

COPY proxy/package*.json ./proxy/
RUN cd proxy && npm install

COPY proxy/ ./proxy/
RUN cd proxy && npm run build

EXPOSE 3001

CMD ["node", "proxy/dist/server.js"]
