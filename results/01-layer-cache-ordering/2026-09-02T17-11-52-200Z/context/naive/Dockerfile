FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install --omit=dev --no-audit --no-fund
CMD ["node", "index.js"]
