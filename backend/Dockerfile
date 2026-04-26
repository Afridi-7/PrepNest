FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY .env.example ./.env.example

EXPOSE 8000

# `--proxy-headers` + `--forwarded-allow-ips "*"` lets uvicorn trust the
# X-Forwarded-For header any reverse proxy (Render LB, nginx, Cloudflare,
# Vercel, etc.) puts in front of us. Without this, every user looks like
# they're coming from the proxy IP and rate limits would 429 real traffic.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
