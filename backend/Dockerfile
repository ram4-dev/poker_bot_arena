FROM python:3.12-slim

WORKDIR /app

# Dependencias del sistema para asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Correr migraciones y arrancar el servidor
CMD ["sh", "-c", "alembic upgrade head && gunicorn app.main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000"]
