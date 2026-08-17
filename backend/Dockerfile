FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Support safe ad-hoc commands such as `uv run python -m app.seed` after the
# image drops privileges. Runtime uv must use a writable cache and must never
# attempt to resynchronize the root-owned production virtual environment.
ENV UV_CACHE_DIR=/tmp/uv-cache \
    UV_NO_SYNC=1
RUN install -d -o 10001 -g 0 /tmp/uv-cache

USER 10001
EXPOSE 8000
CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
