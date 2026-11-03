FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy AUDITOR_DB=/data/auditor.db
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY auditor ./auditor
RUN uv sync --frozen --no-dev
EXPOSE 8080
# One worker on purpose: case sessions and class rooms live in memory.
CMD ["uv", "run", "--no-sync", "uvicorn", "auditor.api:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
