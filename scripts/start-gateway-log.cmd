@echo off
chcp 65001 >nul 2>&1

set DATABASE_URL=postgresql://openclaw_admin:Oc%%402026!Pg%%23Secure@10.157.152.40:22001/openclaw_prod
set JWT_SECRET=Oc@2026!JwtSecret#32CharMinimumRequired
set OPENCLAW_SKIP_CHANNELS=1
set CLAWDBOT_SKIP_CHANNELS=1

cd /d D:\AI-workspace\openclaw
node scripts\run-node.mjs --dev gateway --allow-unconfigured > gateway-output.log 2>&1
