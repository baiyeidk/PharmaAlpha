FROM node:20-slim AS base

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv openssl curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY agents/requirements.txt agents/requirements.txt
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir -r agents/requirements.txt

# Node dependencies
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

ENV PATH="/app/.venv/bin:$PATH"
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]
