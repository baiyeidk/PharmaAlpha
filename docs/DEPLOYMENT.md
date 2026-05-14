# 生产部署 (CI/CD via GitHub Actions + Aliyun ACR)

本项目通过 GitHub Actions 实现 push 到 `main` 自动部署到生产服务器:

- 触发: push `main` 或手动 `workflow_dispatch`
- 流程: **Lint/TypeCheck → 在 Actions runner 上 build 镜像 → push 到阿里云 ACR → SSH 到服务器 docker compose pull + up → 健康检查**
- 服务器: 单台 Linux VPS(阿里云 ECS 北京区),Docker 化运行
- 镜像仓库: 阿里云 ACR 个人版(免费),走 VPC 内网拉取(免流量、不限速)
- 数据库: `docker-compose.yml` 内置 pgvector 服务托管

> 为什么镜像 build 在 Actions、不在服务器:小规格 ECS(2 核 2G)跑 Next.js 16 production build 会 OOM。
> Actions 的 runner 7 GB RAM、多核、build 缓存可复用,15 分钟搞定;服务器只 `docker pull` + `up -d`,纯 IO,几乎不占资源。

> 关键文件:
> - [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — Actions 编排(lint → build & push → ssh deploy)
> - [`docker-compose.production.yml`](../docker-compose.production.yml) — 生产 compose 覆盖(关 demo seed、不暴露 db、healthcheck)
> - [`docker-compose.image.yml`](../docker-compose.image.yml) — 镜像模式覆盖(把 app 从 build 改成 image)
> - [`scripts/server-bootstrap.sh`](../scripts/server-bootstrap.sh) — 服务器首次初始化(装 Docker、建 deploy 用户、clone 仓库)
> - [`scripts/server-acr-login.sh`](../scripts/server-acr-login.sh) — 服务器一次性 docker login 到 ACR(VPC 内网)

---

## 1. 一次性初始化(只在第一次部署前做)

### 1.1 准备一对 SSH 密钥(本机生成,只用于 GitHub Actions)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/pharma_alpha_deploy -N ""
# 输出:
#   ~/.ssh/pharma_alpha_deploy        ← 私钥,稍后给 GitHub Secret
#   ~/.ssh/pharma_alpha_deploy.pub    ← 公钥,稍后放服务器
```

### 1.2 在服务器上跑一次 bootstrap

把 `scripts/server-bootstrap.sh` 上传到服务器并执行(只跑一次,后续靠 Actions):

```bash
scp scripts/server-bootstrap.sh root@<SERVER_IP>:/tmp/
ssh root@<SERVER_IP>
sudo bash /tmp/server-bootstrap.sh \
  --repo  https://github.com/<your-org>/PharmaAlpha.git \
  --path  /opt/pharma-alpha \
  --user  deploy
```

脚本会:
1. 装 Docker(如果没装)
2. 创建 `deploy` 用户并加入 `docker` 组
3. 给 deploy 用户准备 `~/.ssh/authorized_keys`
4. clone 仓库到 `/opt/pharma-alpha`
5. 生成 `.env.production` 模板(如果还没有)

### 1.3 把公钥放到服务器

```bash
# 在服务器上:
echo "<把 ~/.ssh/pharma_alpha_deploy.pub 的内容贴这里>" >> /home/deploy/.ssh/authorized_keys
```

### 1.4 编辑 `.env.production` 填生产秘密

```bash
ssh deploy@<SERVER_IP>
vim /opt/pharma-alpha/.env.production
```

必填项:

```ini
NEXTAUTH_SECRET=          # openssl rand -base64 32
LLM_API_KEY=              # 大模型 API key
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus
DASHSCOPE_API_KEY=
EMBEDDING_PROVIDER=dashscope
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_DIMENSIONS=1024
POSTGRES_PASSWORD=        # 数据库密码,自己定一个强密码
```

> ⚠ 这个文件 **永远不要进 git**,`.gitignore` 已经排除 `.env*`。

### 1.5 准备阿里云 ACR(镜像仓库)

打开 `https://cr.console.aliyun.com/`,选**北京地域**(华北 2),然后:

1. **创建命名空间**:`pharma-alpha`,默认仓库类型 **私有**
2. **创建镜像仓库**:命名空间选刚创建的,仓库名 `app`,代码源选 **本地仓库**
3. **设置 Docker 登录密码**:左侧 → 实例列表 → 个人实例 → 访问凭证 → 设置 Docker 登录密码

记下这 4 个值,下一步要用:

| 项 | 在 ACR 控制台哪里看 | 示例 |
|---|---|---|
| **公网 registry 域名**(GitHub Actions 用) | 仓库详情 → 基本信息 → 公网地址 | `crpi-xxxxxxxxx.cn-beijing.personal.cr.aliyuncs.com` |
| **VPC registry 域名**(服务器拉镜像走内网) | 同上,内网地址 | `crpi-xxxxxxxxx-vpc.cn-beijing.personal.cr.aliyuncs.com` |
| **命名空间** | 你刚建的 | `pharma-alpha` |
| **登录用户名** | 仓库详情页 / RAM 子账号 | `<阿里云账号或子账号>` |

### 1.6 在 GitHub 配置 Secrets

仓库 → **Settings → Secrets and variables → Actions → Secrets**:

| Secret | 值 |
|---|---|
| `SSH_HOST` | 服务器公网 IP |
| `SSH_USER` | `deploy` |
| `SSH_PORT` | `22` |
| `SSH_PRIVATE_KEY` | `~/.ssh/pharma_alpha_deploy` 文件**完整内容**(含 `-----BEGIN/END` 行) |
| `DEPLOY_PATH` | `/opt/pharma-alpha` |
| `ACR_REGISTRY` | 公网 registry 域名(上一步的) |
| `ACR_REGISTRY_VPC` | VPC 内网 registry 域名 |
| `ACR_NAMESPACE` | `pharma-alpha` |
| `ACR_USERNAME` | 阿里云账号或子账号名 |
| `ACR_PASSWORD` | ACR 控制台设置的 Docker 登录密码 |

仓库 → **Settings → Secrets and variables → Actions → Variables**(可选):

| Variable | 值 | 用途 |
|---|---|---|
| `HEALTH_URL` | `http://<域名或IP>:3000/` | 部署后健康检查;不填则跳过 |

### 1.7 在服务器上 docker login 到 ACR(一次性)

GitHub Actions 推镜像后,服务器需要拉私有镜像 — 必须先登录:

```bash
ssh deploy@<SERVER_IP>
cd /opt/pharma-alpha
ACR_PASSWORD='<你的 ACR 登录密码>' \
  ./scripts/server-acr-login.sh \
  --registry crpi-xxxxxxxxx-vpc.cn-beijing.personal.cr.aliyuncs.com \
  --username <你的 ACR 用户名>
```

凭证存到 `~/.docker/config.json`,以后 `docker pull` 自动用。

### 1.8 配置 GitHub Environment(强烈推荐)

仓库 → **Settings → Environments → New environment → `production`**

可选启用:
- **Required reviewers**: 部署前需要人工审批(适合还在试运行阶段)
- **Wait timer**: 部署延迟 N 分钟(给紧急回滚留窗口)
- **Deployment branches**: 限定只允许 `main` 触发

### 1.9 触发首次部署

什么都不用手动做了 —— push 一个 commit,Actions 会自动 build & push & deploy:

```bash
git commit --allow-empty -m "ci: trigger first ACR-based deploy"
git push origin main
```

到 `https://github.com/<你>/PharmaAlpha/actions` 看进度,3 个 job 顺序跑:
1. **Lint & Type Check**(~2 分钟)
2. **Build & Push Image**(首次 ~10-15 分钟,有 cache 后 ~3 分钟)
3. **SSH Deploy**(~30 秒)

全绿之后,浏览器访问 `http://<服务器IP>:3000` 看登录页。

---

## 2. 日常使用

### 2.1 自动部署

```bash
git push origin main
# 然后到 GitHub → Actions 标签页看进度
```

阶段:
1. **Lint & Type Check**(失败则不 build,不部署)
2. **Build & Push Image**: 在 Actions runner 上 `docker buildx build` → push 到 ACR(SHA tag + latest tag)
3. **SSH Deploy**: 服务器上 `git pull`(只为拿最新 compose 文件)+ `docker compose pull` + `up -d`,**不再在服务器 build**
4. **Health check**: 如果配了 `HEALTH_URL`,会探测 30 次(150 秒窗口)

### 2.2 手动触发(无需 push)

仓库 → **Actions → Deploy to Production → Run workflow**

可勾选 "Skip lint checks (emergency hotfix)"——但只在紧急回滚时用。

### 2.3 跳过部署但要 push

commit message 加 `[skip ci]` 或 `[ci skip]`:

```bash
git commit -m "docs: typo fix [skip ci]"
```

### 2.4 回滚到任意旧版本(不需要 build)

每次 Actions 跑完都会在 ACR 里留下一个 `<git-sha-12位>` tag。回滚就是切 tag:

```bash
ssh deploy@<SERVER_IP>
cd /opt/pharma-alpha

# 1. 看 ACR 里有哪些可用版本
#    (打开浏览器,在 ACR 控制台 → 镜像仓库 → app → 镜像版本 看)
#
# 2. 用想要的旧 tag 启动
export IMAGE_TAG=<旧的-12位-sha>
export ACR_REGISTRY_VPC=crpi-xxxxxxxxx-vpc.cn-beijing.personal.cr.aliyuncs.com
export ACR_NAMESPACE=pharma-alpha

docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.image.yml \
  pull

docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.image.yml \
  up -d
```

整个回滚 < 30 秒。如果你想用 latest 标签恢复,把 IMAGE_TAG 设成 `latest` 即可。

---

## 3. 运维清单

> 提示:下面所有 `docker compose ...` 命令前缀都很长。在 deploy 用户的 `~/.bashrc`
> 加一个 alias 一劳永逸:
> ```bash
> alias dcp='docker compose --env-file /opt/pharma-alpha/.env.production -f /opt/pharma-alpha/docker-compose.yml -f /opt/pharma-alpha/docker-compose.production.yml -f /opt/pharma-alpha/docker-compose.image.yml'
> ```
> 之后 `dcp ps` / `dcp logs -f app` / `dcp pull && dcp up -d` 就行。
>
> 同时把 ACR 变量也写进 `~/.bashrc`,免得每次都 export:
> ```bash
> export ACR_REGISTRY_VPC=crpi-xxxxxxxxx-vpc.cn-beijing.personal.cr.aliyuncs.com
> export ACR_NAMESPACE=pharma-alpha
> export IMAGE_TAG=latest
> ```

### 3.1 看日志

```bash
dcp logs -f app
dcp logs -f db
```

或者直接看应用 agent 日志(已通过 volume 挂在宿主机):

```bash
ls /opt/pharma-alpha/agents/logs/
```

### 3.2 备份数据库

强烈建议加到 cron:

```bash
# /etc/cron.daily/pharma-pg-backup
#!/bin/bash
set -e
BACKUP_DIR=/var/backups/pharma-pg
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
docker exec pharma-pg pg_dump -U postgres pharma_alpha | gzip > "$BACKUP_DIR/pharma_alpha_$DATE.sql.gz"
# 保留最近 14 天
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +14 -delete
```

### 3.3 拉最新镜像并重启(等价于触发一次部署但不走 Actions)

```bash
dcp pull
dcp up -d
docker image prune -f
```

### 3.4 改了环境变量后

只重启 app 容器即可:

```bash
dcp up -d --no-build app
```

---

## 4. Schema 迁移行为

`scripts/docker-entrypoint.sh` 启动时按下面的策略处理 schema:

| 数据库当前状态 | entrypoint 行为 |
|---|---|
| 全空(无任何业务表) | `prisma migrate deploy` 从头 apply 所有 migration |
| 已有 `_prisma_migrations` 表(按 migrate 管理过) | `prisma migrate deploy` 增量 apply 待用 migration |
| 有业务表但无 `_prisma_migrations` 表(早期 `db push` 留下的) | **拒绝启动**,提示运维做 baseline |

如果你撞到第三种情况(常见于早期开发库迁到生产),处理一次性 baseline:

```bash
ssh deploy@<SERVER>
cd /opt/pharma-alpha
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml \
  run --rm --entrypoint sh app -c '
    for m in prisma/migrations/2026*; do
      npx prisma migrate resolve --applied "$(basename "$m")"
    done
  '
```

之后 entrypoint 会自动转入第二种状态,后续 `git push main` → `migrate deploy` 一路通。

> 本地 throwaway 开发库如果想保留旧的 `db push` 行为,在 compose 里加 `PRISMA_ALLOW_DB_PUSH=true`。**生产环境永远不要打开这个开关**——它带 `--accept-data-loss`,会直接丢字段。

---

## 5. 国内网络优化(可选)

如果 GitHub Actions 一侧 SSH 进服务器后 `git pull` 慢/超时:

- 在服务器配代理:
  ```bash
  git config --global url."https://gh-proxy.com/https://github.com/".insteadOf "https://github.com/"
  ```
- 或者切到**镜像推路径**(B 方案):Actions build 镜像 push 到阿里云 ACR / 腾讯 TCR,服务器只 `docker compose pull`,完全不碰 GitHub。需要时告诉我,我可以基于现有 workflow 改一版镜像推 + 回滚 tag 的版本。
