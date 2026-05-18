ARG NODE_IMAGE=docker.1ms.run/library/node:20-slim

# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: build-deps
#   完整 npm 依赖（含 devDependencies），仅用于 build 阶段。
#   package-lock.json 不变时整层缓存命中。
# ──────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund --registry https://registry.npmmirror.com

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: prod-deps
#   仅 production 依赖（含 prisma CLI / @prisma/client / next）。
#   最终 runner 镜像只复制这一份 node_modules，不带 tailwind/eslint/typescript。
# ──────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund --registry https://registry.npmmirror.com

# ──────────────────────────────────────────────────────────────────────────────
# Stage 3: python-venv
#   独立缓存 Python 依赖。requirements.txt 不变时整段跳过。
#   注意此阶段安装了 pip/venv，但只用来产出 /app/.venv 拷给 runner。
# ──────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS python-venv
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null || true
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY agents/requirements.txt agents/requirements.txt
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir \
        -i https://mirrors.aliyun.com/pypi/simple/ \
        -r agents/requirements.txt

# ──────────────────────────────────────────────────────────────────────────────
# Stage 4: builder
#   prisma generate + next build。复用 build-deps 的 node_modules。
# ──────────────────────────────────────────────────────────────────────────────
FROM build-deps AS builder
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build

# ──────────────────────────────────────────────────────────────────────────────
# Stage 5: runner
#   最终运行镜像。不含 pip/build-tools/dev-deps。
# ──────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null || true
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 openssl curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python 运行时（来自独立 stage，requirements.txt 不变时完整复用）
COPY --from=python-venv /app/.venv /app/.venv

# Node prod 依赖
COPY --from=prod-deps /app/node_modules ./node_modules

# Prisma client（builder 已 generate）
COPY --from=builder /app/src/generated ./src/generated

# Next 构建产物
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# 运行时所需的源文件
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY agents ./agents
COPY scripts ./scripts
COPY tsconfig.json ./tsconfig.json

RUN sed -i 's/\r$//' scripts/docker-entrypoint.sh && chmod +x scripts/docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH"
ENV NODE_ENV=production
ENV PORT=3000
# Default OFF for safety. The dev-oriented docker-compose.yml flips this to
# `true` via ${RUN_PROJECT_FIRST_SEED:-true}, so local `docker compose up`
# still seeds demo data; production deployments inherit the safe default.
ENV RUN_PROJECT_FIRST_SEED=false

EXPOSE 3000

# Database schema sync and optional demo seed are runtime concerns because the
# database may be managed by docker compose or by an external deployment.
CMD ["sh", "scripts/docker-entrypoint.sh"]
