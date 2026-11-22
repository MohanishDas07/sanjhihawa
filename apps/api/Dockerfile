FROM python:3.12-slim

WORKDIR /app

# Non-root user for security
RUN groupadd -r saans && useradd -r -g saans saans

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api /app/apps/api

ENV PYTHONPATH=/app/apps/api
ENV CACHE_DIR=/app/data
RUN mkdir -p /app/data && chown -R saans:saans /app

USER saans

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--app-dir", "apps/api", "--host", "0.0.0.0", "--port", "8000"]
