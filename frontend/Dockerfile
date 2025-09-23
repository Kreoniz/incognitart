FROM node:24-slim AS base
RUN npm install -g pnpm
WORKDIR /app
COPY . .
RUN pnpm fetch
EXPOSE 5173

FROM base AS dev
RUN pnpm install --frozen-lockfile
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
