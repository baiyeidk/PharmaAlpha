FROM node:20-slim AS base

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null || true
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv openssl curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY agents/requirements.txt agents/requirements.txt
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir \
        -i https://mirrors.aliyun.com/pypi/simple/ \
        -r agents/requirements.txt

# Node dependencies
COPY package.json package-lock.json* ./
RUN npm install --registry https://registry.npmmirror.com

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

CMD ["sh", "-c", "npx prisma db push && npm start"]
