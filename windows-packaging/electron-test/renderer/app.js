/**
 * OpenClaw Desktop - 渲染进程主脚本
 * 负责页面交互、WebSocket 通信和状态管理
 */

const { ipcRenderer } = require("electron");

// ============ 状态管理 ============
const state = {
  connected: false,
  gatewayUrl: "ws://127.0.0.1:18789",
  gatewayToken: "",
  sessionKey: "default",
  password: "",
  currentPage: "chat",

  // Chat 状态
  messages: [],
  stream: null,
  sending: false,
  attachments: [],
  sessions: [],

  // Overview 状态
  hello: null,
  presenceCount: 0,
  sessionsCount: 0,
  cronEnabled: null,
  cronNext: null,
  lastChannelsRefresh: null,
  lastError: null,

  // Skills 状态
  skills: [],
  skillsLoading: false,
  skillsFilter: "",
  skillEdits: {},
  skillMessages: {},
  busySkillKey: null,
};

let ws = null;
let messageIdCounter = 0;
let pendingRequests = new Map();

// ============ 工具函数 ============
function generateId() {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "--";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天 ${hours % 24}小时`;
  if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`;
  if (minutes > 0) return `${minutes}分钟`;
  return `${seconds}秒`;
}

function formatAgo(timestamp) {
  if (!timestamp) return "--";
  const diff = Date.now() - timestamp;
  return formatDuration(diff) + "前";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============ WebSocket 通信 ============
let connectNonce = null;
let connectSent = false;
let connectTimer = null;
let backoffMs = 800;
let lastSeq = null;
let isReconnecting = false;
let intentionalClose = false;

function connect() {
  // 如果已经有连接，先关闭
  if (ws) {
    intentionalClose = true;
    const oldWs = ws;
    ws = null;
    oldWs.onclose = null; // 移除旧的 onclose 处理器，防止触发重连
    oldWs.close();
  }

  const url = state.gatewayUrl || "ws://127.0.0.1:18789";
  console.log("Connecting to:", url);
  updateStatus("正在连接...", false);
  intentionalClose = false;

  try {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("WebSocket connected, queuing connect request...");
      queueConnect();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      state.lastError = "连接错误";
      updateStatus("连接错误", false);
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      state.connected = false;
      state.lastError = event.reason || "连接已断开";
      updateStatus("已断开", false);
      updateOverviewUI();
      flushPending(new Error(`gateway closed (${event.code}): ${event.reason}`));

      // 只有非主动关闭时才重连
      if (!intentionalClose) {
        scheduleReconnect();
      }
    };
  } catch (err) {
    console.error("Failed to connect:", err);
    state.lastError = err.message;
    updateStatus("连接失败", false);
  }
}

function scheduleReconnect() {
  if (state.connected) return;
  const delay = backoffMs;
  backoffMs = Math.min(backoffMs * 1.7, 15000);
  setTimeout(() => connect(), delay);
}

function flushPending(err) {
  for (const [, p] of pendingRequests) {
    p.reject(err);
  }
  pendingRequests.clear();
}

function queueConnect() {
  connectNonce = null;
  connectSent = false;
  if (connectTimer !== null) {
    clearTimeout(connectTimer);
  }
  connectTimer = setTimeout(() => {
    sendConnect();
  }, 750);
}

function sendConnect() {
  if (connectSent) return;
  connectSent = true;
  if (connectTimer !== null) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }

  const auth =
    state.gatewayToken || state.password
      ? { token: state.gatewayToken || undefined, password: state.password || undefined }
      : undefined;

  const params = {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: "openclaw-control-ui",
      version: "1.0.0",
      platform: process.platform || "win32",
      mode: "webchat",
      instanceId: generateId(),
    },
    role: "operator",
    scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
    caps: [],
    auth,
    userAgent: navigator.userAgent,
    locale: navigator.language,
  };

  sendRequest("connect", params)
    .then((hello) => {
      backoffMs = 800;
      state.connected = true;
      state.hello = hello;
      state.lastError = null;
      updateStatus("已连接", true);
      updateOverviewUI();
      loadChatHistory();
      loadSkills();
      loadStats();
    })
    .catch((err) => {
      console.error("Connect failed:", err);
      state.lastError = err.message || "连接失败";
      updateStatus("认证失败", false);
      updateOverviewUI();
      if (ws) {
        ws.close(4008, "connect failed");
      }
    });
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error("gateway not connected"));
      return;
    }

    const id = generateId();
    const frame = {
      type: "req",
      id,
      method,
      params,
    };

    pendingRequests.set(id, { resolve, reject });
    ws.send(JSON.stringify(frame));

    // 30秒超时
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error("请求超时"));
      }
    }, 30000);
  });
}

// 兼容旧的 sendRpc 调用
function sendRpc(method, params = {}) {
  return sendRequest(method, params);
}

function handleMessage(data) {
  // 处理事件帧
  if (data.type === "event") {
    const evt = data;

    // 处理 connect.challenge 事件
    if (evt.event === "connect.challenge") {
      const payload = evt.payload;
      const nonce = payload && typeof payload.nonce === "string" ? payload.nonce : null;
      if (nonce) {
        connectNonce = nonce;
        connectSent = false;
        sendConnect();
      }
      return;
    }

    // 处理序列号
    const seq = typeof evt.seq === "number" ? evt.seq : null;
    if (seq !== null) {
      if (lastSeq !== null && seq > lastSeq + 1) {
        console.warn("Event gap detected:", lastSeq + 1, "to", seq);
      }
      lastSeq = seq;
    }

    // 处理其他事件
    handleEvent(evt);
    return;
  }

  // 处理响应帧
  if (data.type === "res") {
    const res = data;
    const pending = pendingRequests.get(res.id);
    if (!pending) return;
    pendingRequests.delete(res.id);
    if (res.ok) {
      pending.resolve(res.payload);
    } else {
      pending.reject(new Error(res.error?.message || "请求失败"));
    }
    return;
  }

  // 兼容旧格式的 JSON-RPC 响应
  if (data.jsonrpc === "2.0" && data.id) {
    const pending = pendingRequests.get(data.id);
    if (pending) {
      pendingRequests.delete(data.id);
      if (data.error) {
        pending.reject(new Error(data.error.message || "请求失败"));
      } else {
        pending.resolve(data.result);
      }
    }
    return;
  }

  // 兼容旧格式的事件
  switch (data.type) {
    case "hello":
      handleHello(data);
      break;
    case "error":
      handleError(data);
      break;
    case "chat.stream":
      handleChatStream(data);
      break;
    case "chat.message":
      handleChatMessage(data);
      break;
    case "chat.done":
      handleChatDone(data);
      break;
    default:
      console.log("Unknown message:", data);
  }
}

function handleEvent(evt) {
  switch (evt.event) {
    case "chat":
      handleChatEvent(evt.payload || {});
      break;
    case "chat.stream":
      handleChatStream(evt.payload || {});
      break;
    case "chat.message":
      handleChatMessage(evt.payload || {});
      break;
    case "chat.done":
      handleChatDone(evt.payload || {});
      break;
    case "presence.update":
      state.presenceCount = evt.payload?.count || 0;
      updateOverviewUI();
      break;
    case "channels.refresh":
      state.lastChannelsRefresh = Date.now();
      updateOverviewUI();
      break;
    default:
      console.log("Unhandled event:", evt.event, evt.payload);
  }
}

// 处理 chat 事件 (Gateway 发送的统一格式)
function handleChatEvent(payload) {
  const { runId, sessionKey, seq, state: chatState, message, errorMessage } = payload;

  // 只处理当前会话的消息
  if (sessionKey && sessionKey !== state.sessionKey) {
    return;
  }

  switch (chatState) {
    case "delta":
      // 流式输出
      if (message?.content) {
        const text = message.content.find((c) => c.type === "text")?.text || "";
        state.stream = text;
        state.sending = true;
        renderChatMessages();
      }
      break;

    case "final":
      // 最终消息
      state.stream = null;
      state.sending = false;
      document.getElementById("btn-stop").style.display = "none";
      if (message) {
        // 提取文本内容
        let content = "";
        if (Array.isArray(message.content)) {
          content = message.content.map((c) => (c.type === "text" ? c.text : "")).join("");
        } else if (typeof message.content === "string") {
          content = message.content;
        }
        if (content) {
          state.messages.push({
            role: message.role || "assistant",
            content,
            timestamp: message.timestamp || Date.now(),
          });
        }
      }
      renderChatMessages();
      break;

    case "error":
      // 错误
      state.stream = null;
      state.sending = false;
      document.getElementById("btn-stop").style.display = "none";
      console.error("Chat error:", errorMessage);
      renderChatMessages();
      break;

    default:
      console.log("Unknown chat state:", chatState, payload);
  }
}

function handleHello(data) {
  // 兼容旧格式，但主要逻辑已在 sendConnect 中处理
  if (data.ok) {
    state.connected = true;
    state.hello = data;
    state.lastError = null;
    updateStatus("已连接", true);
    updateOverviewUI();
    loadChatHistory();
    loadSkills();
    loadStats();
  } else {
    state.connected = false;
    state.lastError = data.error || "认证失败";
    updateStatus("认证失败", false);
    updateOverviewUI();
  }
}

function handleError(data) {
  console.error("Server error:", data.message);
  state.lastError = data.message;
  updateOverviewUI();
}

function handleChatStream(data) {
  state.stream = (state.stream || "") + (data.text || "");
  state.sending = true;
  renderChatMessages();
}

function handleChatMessage(data) {
  if (data.message) {
    state.messages.push(data.message);
    renderChatMessages();
  }
}

function handleChatDone(data) {
  state.stream = null;
  state.sending = false;
  document.getElementById("btn-stop").style.display = "none";
  renderChatMessages();
}

// ============ Chat 功能 ============
async function loadChatHistory() {
  try {
    const result = await sendRpc("chat.history", { sessionKey: state.sessionKey });
    state.messages = result.messages || [];
    renderChatMessages();
  } catch (err) {
    console.error("Failed to load chat history:", err);
  }
}

async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();

  if (!text && state.attachments.length === 0) return;
  if (!state.connected) return;

  // 添加用户消息到列表
  const userMessage = {
    role: "user",
    content: text,
    timestamp: Date.now(),
    attachments: state.attachments.map((a) => ({ dataUrl: a.dataUrl, mimeType: a.mimeType })),
  };
  state.messages.push(userMessage);

  // 清空输入
  input.value = "";
  state.attachments = [];
  renderAttachments();
  renderChatMessages();

  // 显示停止按钮
  state.sending = true;
  document.getElementById("btn-stop").style.display = "block";

  // 生成唯一的 idempotencyKey
  const idempotencyKey = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    await sendRpc("chat.send", {
      sessionKey: state.sessionKey,
      message: text,
      idempotencyKey,
      attachments:
        userMessage.attachments.length > 0
          ? userMessage.attachments.map((a) => ({
              type: "image",
              mimeType: a.mimeType,
              content: a.dataUrl.split(",")[1], // 提取 base64 部分
            }))
          : undefined,
    });
  } catch (err) {
    console.error("Failed to send message:", err);
    state.sending = false;
    document.getElementById("btn-stop").style.display = "none";
  }
}

async function stopGeneration() {
  try {
    await sendRpc("chat.abort", { sessionKey: state.sessionKey });
  } catch (err) {
    console.error("Failed to stop generation:", err);
  }
  state.sending = false;
  state.stream = null;
  document.getElementById("btn-stop").style.display = "none";
  renderChatMessages();
}

async function newSession() {
  const key = `session-${Date.now()}`;
  state.sessionKey = key;
  state.messages = [];
  renderChatMessages();

  // 更新会话选择器
  const select = document.getElementById("session-select");
  const option = document.createElement("option");
  option.value = key;
  option.textContent = key;
  select.appendChild(option);
  select.value = key;
}

function renderChatMessages() {
  const container = document.getElementById("chat-messages");

  if (state.messages.length === 0 && !state.stream) {
    container.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <div class="chat-empty-title">开始对话</div>
        <div class="chat-empty-desc">
          在下方输入框中输入消息，按 Enter 发送。<br>
          支持粘贴图片作为附件。
        </div>
      </div>
    `;
    return;
  }

  let html = "";
  let lastRole = null;

  for (const msg of state.messages) {
    const role = msg.role === "user" ? "user" : "assistant";
    const isNewGroup = role !== lastRole;

    if (isNewGroup && lastRole !== null) {
      html += "</div></div>";
    }

    if (isNewGroup) {
      const avatar = role === "user" ? "👤" : "🦞";
      html += `
        <div class="message-group ${role}">
          <div class="message-avatar ${role}">${avatar}</div>
          <div class="message-content">
      `;
    }

    html += `<div class="message-bubble">${formatMessageContent(msg.content)}</div>`;
    lastRole = role;
  }

  if (lastRole !== null) {
    html += "</div></div>";
  }

  // 流式输出
  if (state.stream) {
    html += `
      <div class="message-group assistant">
        <div class="message-avatar assistant">🦞</div>
        <div class="message-content">
          <div class="message-bubble">${formatMessageContent(state.stream)}</div>
        </div>
      </div>
    `;
  } else if (state.sending) {
    html += `
      <div class="message-group assistant">
        <div class="message-avatar assistant">🦞</div>
        <div class="message-content">
          <div class="message-bubble">
            <div class="typing-indicator">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function formatMessageContent(content) {
  if (!content) return "";

  // 处理 content blocks 数组格式（从 API 返回的消息）
  let text = "";
  if (Array.isArray(content)) {
    const parts = [];
    for (const block of content) {
      if (block.type === "text" && block.text) {
        parts.push(block.text);
      } else if (block.type === "image" && block.source) {
        // 处理图片
        const src =
          block.source.type === "base64"
            ? `data:${block.source.media_type};base64,${block.source.data}`
            : block.source.url || "";
        if (src) {
          parts.push(`<img src="${src}" class="message-image" alt="图片">`);
        }
      }
    }
    text = parts.join("");
    // 如果包含图片标签，直接返回（不做 Markdown 处理）
    if (text.includes("<img")) {
      return text;
    }
  } else {
    text = content;
  }

  // 简单的 Markdown 处理
  let html = escapeHtml(text);

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");

  // 行内代码
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 粗体
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 斜体
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // 换行
  html = html.replace(/\n/g, "<br>");

  return html;
}

function renderAttachments() {
  const container = document.getElementById("chat-attachments");

  if (state.attachments.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = state.attachments
    .map(
      (att, index) => `
    <div class="chat-attachment">
      <img src="${att.dataUrl}" alt="附件">
      <button class="chat-attachment-remove" data-index="${index}">×</button>
    </div>
  `,
    )
    .join("");

  // 绑定删除事件
  container.querySelectorAll(".chat-attachment-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = parseInt(btn.dataset.index);
      state.attachments.splice(index, 1);
      renderAttachments();
    });
  });
}

// ============ Overview 功能 ============
async function loadStats() {
  try {
    const [sessions, cron] = await Promise.all([
      sendRpc("sessions.list", {}).catch(() => ({ sessions: [] })),
      sendRpc("cron.status", {}).catch(() => ({ enabled: null, next: null })),
    ]);

    state.sessionsCount = sessions.sessions?.length || 0;
    state.cronEnabled = cron.enabled;
    state.cronNext = cron.next;

    updateOverviewUI();
  } catch (err) {
    console.error("Failed to load stats:", err);
  }
}

function updateOverviewUI() {
  // 状态徽章
  const badge = document.getElementById("overview-status-badge");
  const statusText = document.getElementById("overview-status-text");
  if (badge && statusText) {
    badge.className = `overview-status-badge ${state.connected ? "connected" : "disconnected"}`;
    statusText.textContent = state.connected ? "已连接" : "未连接";
  }

  // 统计数据
  const statInstances = document.getElementById("stat-instances");
  const statSessions = document.getElementById("stat-sessions");
  const statCron = document.getElementById("stat-cron");
  const statCronNext = document.getElementById("stat-cron-next");
  const statUptime = document.getElementById("stat-uptime");

  if (statInstances) statInstances.textContent = state.presenceCount;
  if (statSessions) statSessions.textContent = state.sessionsCount;
  if (statCron)
    statCron.textContent = state.cronEnabled == null ? "--" : state.cronEnabled ? "启用" : "禁用";
  if (statCronNext)
    statCronNext.textContent = state.cronNext
      ? `下次运行: ${formatAgo(state.cronNext)}`
      : "下次运行: --";

  // 运行时间
  const snapshot = state.hello?.snapshot;
  if (statUptime && snapshot?.uptimeMs) {
    statUptime.textContent = formatDuration(snapshot.uptimeMs);
  }

  // 快照信息
  const snapshotStatus = document.getElementById("snapshot-status");
  const snapshotTick = document.getElementById("snapshot-tick");
  const snapshotChannels = document.getElementById("snapshot-channels");
  const snapshotPort = document.getElementById("snapshot-port");

  if (snapshotStatus) {
    snapshotStatus.textContent = state.connected ? "已连接" : "未连接";
    snapshotStatus.className = `overview-snapshot-value ${state.connected ? "success" : "danger"}`;
  }
  if (snapshotTick && snapshot?.policy?.tickIntervalMs) {
    snapshotTick.textContent = `${snapshot.policy.tickIntervalMs}ms`;
  }
  if (snapshotChannels && state.lastChannelsRefresh) {
    snapshotChannels.textContent = formatAgo(state.lastChannelsRefresh);
  }

  // 错误信息
  const errorDiv = document.getElementById("overview-error");
  const errorMessage = document.getElementById("overview-error-message");
  if (errorDiv && errorMessage) {
    if (state.lastError) {
      errorDiv.style.display = "block";
      errorMessage.textContent = state.lastError;
    } else {
      errorDiv.style.display = "none";
    }
  }
}

// ============ Skills 功能 ============
async function loadSkills() {
  state.skillsLoading = true;
  renderSkillsList();

  try {
    const result = await sendRpc("skills.status", {});
    state.skills = result.skills || [];
    state.skillsLoading = false;
    renderSkillsList();
  } catch (err) {
    console.error("Failed to load skills:", err);
    state.skillsLoading = false;
    state.skills = [];
    renderSkillsList();
  }
}

async function toggleSkill(skillKey, currentlyDisabled) {
  state.busySkillKey = skillKey;
  renderSkillsList();

  try {
    await sendRpc("skills.update", {
      skillKey,
      enabled: currentlyDisabled, // 如果当前禁用，则启用
    });
    state.skillMessages[skillKey] = {
      kind: "success",
      message: currentlyDisabled ? "已启用" : "已禁用",
    };
    await loadSkills();
  } catch (err) {
    state.skillMessages[skillKey] = { kind: "error", message: err.message };
  }

  state.busySkillKey = null;
  renderSkillsList();

  // 3秒后清除消息
  setTimeout(() => {
    delete state.skillMessages[skillKey];
    renderSkillsList();
  }, 3000);
}

async function saveSkillApiKey(skillKey) {
  const apiKey = state.skillEdits[skillKey];
  if (!apiKey) return;

  state.busySkillKey = skillKey;
  renderSkillsList();

  try {
    await sendRpc("skills.saveApiKey", { skillKey, apiKey });
    state.skillMessages[skillKey] = { kind: "success", message: "API Key 已保存" };
    delete state.skillEdits[skillKey];
  } catch (err) {
    state.skillMessages[skillKey] = { kind: "error", message: err.message };
  }

  state.busySkillKey = null;
  renderSkillsList();

  setTimeout(() => {
    delete state.skillMessages[skillKey];
    renderSkillsList();
  }, 3000);
}

async function installSkill(skillKey, name, installId) {
  state.busySkillKey = skillKey;
  renderSkillsList();

  try {
    await sendRpc("skills.install", { skillKey, installId });
    state.skillMessages[skillKey] = { kind: "success", message: "安装成功" };
    await loadSkills();
  } catch (err) {
    state.skillMessages[skillKey] = { kind: "error", message: err.message };
  }

  state.busySkillKey = null;
  renderSkillsList();

  setTimeout(() => {
    delete state.skillMessages[skillKey];
    renderSkillsList();
  }, 3000);
}

function renderSkillsList() {
  const container = document.getElementById("skills-list");
  const countEl = document.getElementById("skills-count");

  if (state.skillsLoading) {
    container.innerHTML = `
      <div class="skills-loading">
        <div class="spinner"></div>
        <div class="loading-text">正在加载技能列表...</div>
      </div>
    `;
    return;
  }

  const filter = state.skillsFilter.toLowerCase();
  const filtered = filter
    ? state.skills.filter((s) =>
        [s.name, s.description, s.source].join(" ").toLowerCase().includes(filter),
      )
    : state.skills;

  if (countEl) {
    countEl.textContent = `${filtered.length} 个技能`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="skills-empty">
        <div class="skills-empty-icon">⚡</div>
        <div class="skills-empty-title">未找到技能</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((skill) => {
      const busy = state.busySkillKey === skill.skillKey;
      const message = state.skillMessages[skill.skillKey];
      const apiKey = state.skillEdits[skill.skillKey] || "";
      const canInstall = skill.install?.length > 0 && skill.missing?.bins?.length > 0;

      const missing = [
        ...(skill.missing?.bins || []).map((b) => `bin:${b}`),
        ...(skill.missing?.env || []).map((e) => `env:${e}`),
        ...(skill.missing?.config || []).map((c) => `config:${c}`),
        ...(skill.missing?.os || []).map((o) => `os:${o}`),
      ];

      const sourceClass =
        skill.source === "bundled"
          ? "bundled"
          : skill.source === "managed"
            ? "managed"
            : "workspace";

      return `
      <div class="skill-card ${skill.disabled ? "disabled" : ""}">
        <div class="skill-icon">${skill.emoji || "⚡"}</div>
        <div class="skill-content">
          <div class="skill-header">
            <span class="skill-name">${escapeHtml(skill.name)}</span>
            <div class="skill-badges">
              <span class="skill-source ${sourceClass}">${skill.source}</span>
              <span class="skill-badge ${skill.eligible ? "eligible" : "blocked"}">
                ${skill.eligible ? "可用" : "受限"}
              </span>
              ${skill.disabled ? '<span class="skill-badge disabled">已禁用</span>' : ""}
            </div>
          </div>
          <div class="skill-desc">${escapeHtml(skill.description || "")}</div>
          ${missing.length > 0 ? `<div class="skill-missing">缺少: ${missing.join(", ")}</div>` : ""}
        </div>
        <div class="skill-actions">
          <div class="skill-toggle">
            <span class="skill-toggle-label">${skill.disabled ? "已禁用" : "已启用"}</span>
            <div class="skill-switch ${skill.disabled ? "" : "active"}"
                 onclick="toggleSkill('${skill.skillKey}', ${skill.disabled})"
                 ${busy ? 'style="pointer-events: none; opacity: 0.5;"' : ""}></div>
          </div>
          ${
            canInstall
              ? `
            <button class="skill-install-btn" onclick="installSkill('${skill.skillKey}', '${escapeHtml(skill.name)}', '${skill.install[0].id}')" ${busy ? "disabled" : ""}>
              ${busy ? "安装中..." : skill.install[0].label}
            </button>
          `
              : ""
          }
          ${
            skill.primaryEnv
              ? `
            <div class="skill-apikey">
              <label class="skill-apikey-label">API Key</label>
              <input type="password" class="skill-apikey-input" value="${apiKey}"
                     onchange="state.skillEdits['${skill.skillKey}'] = this.value">
              <button class="btn btn-sm btn-primary" onclick="saveSkillApiKey('${skill.skillKey}')" ${busy ? "disabled" : ""}>
                保存
              </button>
            </div>
          `
              : ""
          }
          ${
            message
              ? `
            <div class="skill-message ${message.kind}">${escapeHtml(message.message)}</div>
          `
              : ""
          }
        </div>
      </div>
    `;
    })
    .join("");
}

// ============ UI 更新 ============
function updateStatus(text, connected) {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  if (statusDot) {
    statusDot.className = `nav-status-dot ${connected ? "" : "disconnected"}`;
  }
  if (statusText) {
    statusText.textContent = text;
  }
}

function switchPage(page) {
  console.log("switchPage called with:", page, "current:", state.currentPage);
  if (!page) {
    console.error("switchPage: page is undefined");
    return;
  }
  if (page === state.currentPage) {
    console.log("switchPage: same page, skipping");
    return;
  }

  // 更新导航
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.page === page);
  });

  // 更新页面
  document.querySelectorAll(".page").forEach((p) => {
    const isActive = p.id === `page-${page}`;
    console.log("Page:", p.id, "isActive:", isActive);
    p.classList.toggle("active", isActive);
  });

  state.currentPage = page;
  console.log("switchPage: switched to", page);

  // 页面切换时刷新数据
  if (page === "skills" && state.connected) {
    loadSkills();
  } else if (page === "overview" && state.connected) {
    loadStats();
  }
}

// ============ 初始化 ============
async function init() {
  console.log("Initializing OpenClaw Desktop...");

  // 设置默认值
  state.gatewayUrl = "ws://127.0.0.1:18789";
  document.getElementById("input-gateway-url").value = state.gatewayUrl;

  // 从主进程获取配置
  const status = await ipcRenderer.invoke("get-gateway-status");
  if (status.token) {
    state.gatewayToken = status.token;
    document.getElementById("input-gateway-token").value = status.token;
  }
  if (status.port) {
    state.gatewayUrl = `ws://127.0.0.1:${status.port}`;
    document.getElementById("input-gateway-url").value = state.gatewayUrl;
  }

  // 更新状态为未连接
  updateStatus("未连接", false);

  // 绑定导航事件
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchPage(tab.dataset.page));
  });

  // 绑定 Chat 事件
  const chatInput = document.getElementById("chat-input");
  const btnSend = document.getElementById("btn-send");
  const btnStop = document.getElementById("btn-stop");
  const btnNewSession = document.getElementById("btn-new-session");

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + "px";
  });

  chatInput.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = () => {
          state.attachments.push({
            id: generateId(),
            dataUrl: reader.result,
            mimeType: file.type,
          });
          renderAttachments();
        };
        reader.readAsDataURL(file);
      }
    }
  });

  btnSend.addEventListener("click", sendChatMessage);
  btnStop.addEventListener("click", stopGeneration);
  btnNewSession.addEventListener("click", newSession);

  // 绑定 Overview 事件
  const btnConnect = document.getElementById("btn-connect");
  const btnRefresh = document.getElementById("btn-refresh");
  const inputGatewayUrl = document.getElementById("input-gateway-url");
  const inputGatewayToken = document.getElementById("input-gateway-token");
  const inputPassword = document.getElementById("input-password");
  const inputSessionKey = document.getElementById("input-session-key");

  btnConnect.addEventListener("click", () => {
    let url = inputGatewayUrl.value || "ws://127.0.0.1:18789";
    // 支持用户输入 http/https 格式，自动转换为 ws/wss
    if (url.startsWith("https://")) {
      url = url.replace("https://", "wss://");
    } else if (url.startsWith("http://")) {
      url = url.replace("http://", "ws://");
    }
    state.gatewayUrl = url;
    state.gatewayToken = inputGatewayToken.value;
    state.password = inputPassword.value;
    state.sessionKey = inputSessionKey.value || "default";
    connect();
  });

  btnRefresh.addEventListener("click", () => {
    if (state.connected) {
      loadStats();
    }
  });

  // 绑定密码显示/隐藏事件
  const toggleGatewayToken = document.getElementById("toggle-gateway-token");
  const togglePassword = document.getElementById("toggle-password");

  toggleGatewayToken.addEventListener("click", () => {
    const input = document.getElementById("input-gateway-token");
    if (input.type === "password") {
      input.type = "text";
      toggleGatewayToken.textContent = "🙈";
    } else {
      input.type = "password";
      toggleGatewayToken.textContent = "👁️";
    }
  });

  togglePassword.addEventListener("click", () => {
    const input = document.getElementById("input-password");
    if (input.type === "password") {
      input.type = "text";
      togglePassword.textContent = "🙈";
    } else {
      input.type = "password";
      togglePassword.textContent = "👁️";
    }
  });

  // 绑定 Skills 事件
  const skillsSearch = document.getElementById("skills-search");
  const btnRefreshSkills = document.getElementById("btn-refresh-skills");

  skillsSearch.addEventListener("input", (e) => {
    state.skillsFilter = e.target.value;
    renderSkillsList();
  });

  btnRefreshSkills.addEventListener("click", () => {
    if (state.connected) {
      loadSkills();
    }
  });

  // 不自动连接，等待用户手动点击连接按钮
  // 检测本地 Gateway 状态（后台运行，不阻塞UI）
  checkGatewayStatus();
}

async function checkGatewayStatus() {
  try {
    const status = await ipcRenderer.invoke("get-gateway-status");
    if (status.running && status.url) {
      updateStatus("网关已就绪，请点击连接", false);
    } else {
      updateStatus("未连接 - 可连接本地或远程网关", false);
    }
  } catch (err) {
    console.error("Failed to check gateway status:", err);
    updateStatus("未连接", false);
  }
}

// 暴露全局函数供 HTML 调用
window.toggleSkill = toggleSkill;
window.saveSkillApiKey = saveSkillApiKey;
window.installSkill = installSkill;
window.state = state;

// 启动应用
document.addEventListener("DOMContentLoaded", init);
