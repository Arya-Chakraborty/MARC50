# Stage 1: Build
FROM node:18-bullseye as builder

# Install Python and Java
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    openjdk-17-jre-headless && \
    # Clean up apt lists to reduce layer size
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Install Python dependencies into venv
# Make sure venv is created inside /app so it gets copied
RUN python3 -m venv /app/venv && \
    # Activate venv for this RUN command *only*
    . /app/venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r api/requirements.txt

# Install Node dependencies and build
RUN npm install && \
    npm run build

# Stage 2: Runtime
FROM node:18-bullseye-slim

# <<--- ADD PYTHON INSTALLATION HERE --- >>
# Install Python 3 runtime dependency needed to execute the script
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Copy everything from builder, including node_modules, .next, AND venv
COPY --from=builder /app .

# Only install production Node dependencies (should already be there from COPY, but standard practice)
# This might reinstall/verify based on package-lock.json
RUN npm install --omit=dev

# << --- ADJUST CMD --- >>
# Use the Python executable from the virtual environment directly
# Make sure your package.json start-production script reflects this OR change CMD directly
# Option A: Modify package.json (Recommended if you keep `npm run start-production`)
# In package.json -> scripts -> start-production:
# "start-production": "concurrently \"/app/venv/bin/python api/index.py\" \"next start\""

# Option B: Modify CMD directly (Simpler if start-production is ONLY for this)
CMD ["concurrently", "/app/venv/bin/python", "api/index.py", "npm", "run", "start-next"]
# Note: Adjust the "npm run start-next" part if `next start` needs specific arguments or handling