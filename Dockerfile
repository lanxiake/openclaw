FROM node:22-bookworm

# Install Bun (optional, used by db:seed only)
# Primary: npmmirror China CDN; Fallback: official bun.sh
RUN BUN_VERSION="1.2.4" && \
    BUN_ARCHIVE="bun-linux-x64.zip" && \
    (curl -fsSL --connect-timeout 15 -o /tmp/bun.zip \
      "https://registry.npmmirror.com/-/binary/bun/v${BUN_VERSION}/${BUN_ARCHIVE}" || \
     curl -fsSL --connect-timeout 15 -o /tmp/bun.zip \
      "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${BUN_ARCHIVE}") && \
    unzip -q /tmp/bun.zip -d /tmp/bun-extract && \
    mv /tmp/bun-extract/bun-linux-x64/bun /usr/local/bin/bun && \
    chmod +x /usr/local/bin/bun && \
    rm -rf /tmp/bun.zip /tmp/bun-extract || \
    echo "Bun install skipped (network unavailable)"
ENV PATH="/usr/local/bin:${PATH}"

RUN corepack enable

WORKDIR /app

ARG OPENCLAW_DOCKER_APT_PACKAGES=""
RUN if [ -n "$OPENCLAW_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $OPENCLAW_DOCKER_APT_PACKAGES && \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*; \
    fi

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts
COPY vendor/libsignal-stub ./vendor/libsignal-stub

RUN pnpm install --frozen-lockfile

# 手动链接 libsignal-stub（pnpm link: 协议在 Docker 构建中可能失效）
RUN ln -sf /app/vendor/libsignal-stub /app/node_modules/libsignal

COPY . .
RUN OPENCLAW_A2UI_SKIP_MISSING=1 pnpm build
# Force pnpm for UI build (Bun may fail on ARM/Synology architectures)
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm ui:build

ENV NODE_ENV=production

# Security hardening: Run as non-root user
# The node:22-bookworm image includes a 'node' user (uid 1000)
# This reduces the attack surface by preventing container escape via root privileges
USER node

CMD ["node", "dist/index.js"]
