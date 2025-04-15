FROM python:3.9-slim as python-base

# Install Java and dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-17-jre-headless && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM node:18-bullseye
WORKDIR /app

# Copy Python from the python-base image
COPY --from=python-base /usr/local /usr/local
COPY --from=python-base /app /app

COPY . .

# Install Node dependencies and build
RUN npm install && npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5328/health || exit 1

# Run both services
CMD ["sh", "-c", "python api/index.py & next start"]