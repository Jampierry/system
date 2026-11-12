# Memoritrix: API + app web em uma única imagem (porta 8787).
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci && npm run build
ENV NODE_ENV=production PORT=8787 DB_PATH=/data/cerebro.sqlite
VOLUME /data
EXPOSE 8787
CMD ["npm", "start"]
