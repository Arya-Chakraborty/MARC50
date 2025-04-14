FROM node:18-bullseye

# Install Python and Java
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    openjdk-17-jre-headless

# Set up the project
WORKDIR /app
COPY . .

# Install Python dependencies
RUN python3 -m venv venv && \
    . venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r api/requirements.txt

# Install Node dependencies
RUN npm install && \
    npm run build

# Runtime command
CMD . venv/bin/activate && npm run start-production