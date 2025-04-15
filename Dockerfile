# Stage 1: Build Python & Node Dependencies + Next.js Build Output
FROM node:18-bullseye as builder

# Install Python, Venv, Pip, and Java (for padelpy)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    openjdk-17-jre-headless && \
    # Clean up apt cache
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy application code and configuration files
COPY . .

# Create a virtual environment in /app/venv
# This ensures it's copied to the final stage
RUN python3 -m venv /app/venv

# Install Python dependencies into the virtual environment
# Activate venv just for this RUN command
RUN . /app/venv/bin/activate && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r api/requirements.txt

# Install Node.js dependencies and build the Next.js application
# Using --no-package-lock to potentially avoid issues if lockfile is out of sync, adjust if needed
RUN npm install --no-package-lock && \
    npm run build

# Remove development-only node modules before copying to final stage (optional, saves space)
# RUN npm prune --production # Uncomment if you want to minimize node_modules size further

# Stage 2: Runtime - Create the final, smaller image
FROM node:18-bullseye-slim

# Install Python 3 runtime needed by the Flask API script
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 && \
    # Clean up apt cache
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built assets and necessary dependencies from the builder stage
# This includes:
# - Python virtual environment (/app/venv)
# - Built Next.js app (/.next)
# - Production Node modules (/node_modules)
# - Application code (api/*, app/*, public/*, config files, etc.)
COPY --from=builder /app .

# Re-install production Node dependencies based on package-lock.json in the final stage (optional but recommended for consistency)
# The COPY should bring node_modules, but this ensures alignment with package-lock.json if prune wasn't used
# If you uncommented `npm prune` above, this step is necessary. Otherwise, it might be redundant but safe.
RUN npm install --omit=dev --no-package-lock

# Expose the port Next.js will run on (Render injects PORT env var, typically 10000)
# This is documentation; Render handles the actual port mapping.
EXPOSE 10000

# The command to start the application using npm script
# This uses the start-production script from package.json
# `npm run` correctly handles the PATH for finding `concurrently` in node_modules/.bin
CMD [ "npm", "run", "start-production" ]