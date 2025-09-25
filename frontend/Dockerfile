#FROM node:24-slim AS base
#RUN npm install -g pnpm
#WORKDIR /app
#COPY . .
#RUN pnpm fetch
#EXPOSE 5173
#
#FROM base AS dev
#RUN pnpm install --frozen-lockfile
#CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]

FROM node:24-slim AS base
RUN npm install -g pnpm
WORKDIR /app
COPY . .
# Remove: RUN pnpm fetch (optional; it's for offline installs, but can be skipped for simplicity in dev)
EXPOSE 5173

FROM base AS dev
# Remove: RUN pnpm install --frozen-lockfile
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm dev --host 0.0.0.0 --port 5173"]
