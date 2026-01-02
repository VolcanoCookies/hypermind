FROM node:18-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

ENV npm_config_build_from_source=true
ENV PYTHON=/usr/bin/python3

COPY package*.json ./

RUN npm ci --only=production

COPY server.js ./

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
