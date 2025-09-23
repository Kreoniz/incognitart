FROM python:3.13-slim AS base
COPY --from=docker.io/astral/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY . .

RUN uv sync --locked

EXPOSE 8000

FROM base AS dev
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
