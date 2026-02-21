param(
    [Parameter(Mandatory = $false)]
    [string]$Host = "1.14.110.155",

    [Parameter(Mandatory = $false)]
    [int]$Port = 22,

    [Parameter(Mandatory = $false)]
    [string]$User = "root",

    [Parameter(Mandatory = $false)]
    [string]$KeyPath = ".\my-docs\部署信息\mtbot.pem",

    [Parameter(Mandatory = $false)]
    [string]$RemoteDir = "/opt/mtbot",

    [Parameter(Mandatory = $false)]
    [string]$Branch = "main",

    [Parameter(Mandatory = $false)]
    [string]$RepoUrl = "",

    [Parameter(Mandatory = $false)]
    [switch]$SkipGitPull
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[deploy] $Message" -ForegroundColor Cyan
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw "未找到 ssh 命令，请先安装 OpenSSH Client。"
}

$resolvedKeyPath = Resolve-Path -Path $KeyPath -ErrorAction Stop
Write-Step "使用密钥: $resolvedKeyPath"

$remoteScript = @'
set -euo pipefail

REMOTE_DIR="$1"
BRANCH="$2"
REPO_URL="$3"
SKIP_GIT_PULL="$4"

echo "[remote] deploy path: ${REMOTE_DIR}"
echo "[remote] branch: ${BRANCH}"

if [ ! -d "${REMOTE_DIR}" ]; then
  mkdir -p "${REMOTE_DIR}"
fi

if [ ! -d "${REMOTE_DIR}/.git" ]; then
  if [ -z "${REPO_URL}" ]; then
    echo "[remote] 错误: ${REMOTE_DIR} 不是 git 仓库，请传入 -RepoUrl 进行首次 clone。"
    exit 1
  fi
  echo "[remote] 首次部署: clone ${REPO_URL}"
  rm -rf "${REMOTE_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${REMOTE_DIR}"
fi

cd "${REMOTE_DIR}"

if [ "${SKIP_GIT_PULL}" != "1" ]; then
  echo "[remote] git pull latest..."
  git fetch origin "${BRANCH}"
  git checkout "${BRANCH}"
  git pull --ff-only origin "${BRANCH}"
else
  echo "[remote] 跳过 git pull"
fi

if [ ! -f "my-docs/部署信息/.env.infra" ]; then
  echo "[remote] 缺少 my-docs/部署信息/.env.infra"
  echo "[remote] 请从 env.infra.example.txt 复制并填写。"
  exit 1
fi

if [ ! -f "my-docs/部署信息/.env.production" ]; then
  echo "[remote] 缺少 my-docs/部署信息/.env.production"
  echo "[remote] 请从 env.production.example.txt 复制并填写。"
  exit 1
fi

echo "[remote] 启动基础设施..."
docker compose \
  --project-directory "${REMOTE_DIR}" \
  -f "${REMOTE_DIR}/my-docs/部署信息/docker-compose.infra.yml" \
  --env-file "${REMOTE_DIR}/my-docs/部署信息/.env.infra" \
  up -d

echo "[remote] 启动应用服务..."
docker compose \
  --project-directory "${REMOTE_DIR}" \
  -f "${REMOTE_DIR}/my-docs/部署信息/docker-compose.prod.yml" \
  --env-file "${REMOTE_DIR}/my-docs/部署信息/.env.production" \
  up -d --build

echo "[remote] 当前服务状态:"
docker compose \
  --project-directory "${REMOTE_DIR}" \
  -f "${REMOTE_DIR}/my-docs/部署信息/docker-compose.prod.yml" \
  ps

echo "[remote] 部署完成"
'@

$sshTarget = "$User@$Host"
$skipFlag = if ($SkipGitPull) { "1" } else { "0" }

Write-Step "连接服务器: $sshTarget`:$Port"
$remoteScript | ssh -i $resolvedKeyPath -p $Port $sshTarget bash -s -- $RemoteDir $Branch $RepoUrl $skipFlag

Write-Step "发布成功"
