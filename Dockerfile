FROM node:22-slim

# Install system deps: python3, ffmpeg (for audio processing), git
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl git \
    && rm -rf /var/lib/apt/lists/*

# Install faster-whisper + edge-tts globally
RUN pip3 install --break-system-packages --no-cache-dir \
    faster-whisper==1.2.1 edge-tts==7.2.8

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Type check
RUN npm run typecheck

EXPOSE 3001

# Run via tsx in development, or node in production (compile first)
CMD ["npx", "tsx", "src/backend/server.ts"]
