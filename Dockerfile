# Stage 1: Build
FROM node:18-bullseye as builder

# Install Python and Java
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    openjdk-17-jre-headless

WORKDIR /app
COPY . .

# Install Python dependencies
RUN python3 -m venv venv && \
    . venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r api/requirements.txt

# Install Node dependencies and build
RUN npm install && \
    npm run build

# Stage 2: Runtime
FROM node:18-bullseye-slim

WORKDIR /app
COPY --from=builder /app .

# Only install production dependencies
RUN npm install --omit=dev

CMD [ "npm", "run", "start-production" ]