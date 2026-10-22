FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV TZ=America/Guayaquil
EXPOSE 3000
CMD ["node", "dist/main.js"]
