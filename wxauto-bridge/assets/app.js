/**
 * 微信桥接配置页面前端逻辑
 * 与 Python 后端通过 pywebview API 通信
 */

// ============================================
// 全局状态
// ============================================

const state = {
    config: {
        gateway_url: 'ws://localhost:18789',
        auth_token: '',
        listen_chats: []
    },
    currentTab: 'all',
    isRunning: false,
    logs: [],
    maxLogs: 100
};

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[App] 页面初始化...');
    await waitForPywebview();
    await loadConfig();
    await loadHistoryLogs();
    updateUI();
    console.log('[App] 初始化完成');
});

async function waitForPywebview() {
    return new Promise(function(resolve) {
        if (window.pywebview && window.pywebview.api) {
            resolve();
            return;
        }
        window.addEventListener('pywebviewready', function() { resolve(); });
        setTimeout(function() { resolve(); }, 3000);
    });
}

// ============================================
// 配置管理
// ============================================

async function loadConfig() {
    try {
        if (window.pywebview && window.pywebview.api) {
            state.config = await window.pywebview.api.get_config();
        }
        updateConfigUI();
    } catch (error) {
        showToast('加载配置失败', 'error');
    }
}

async function saveConfig() {
    try {
        state.config.gateway_url = document.getElementById('gatewayUrl').value.trim();
        state.config.auth_token = document.getElementById('authToken').value.trim();

        if (window.pywebview && window.pywebview.api) {
            var result = await window.pywebview.api.save_config(state.config);
            if (result.success) {
                showToast('配置已保存', 'success');
                addLog('info', '配置已保存');
            } else {
                showToast('保存失败: ' + result.error, 'error');
            }
        } else {
            showToast('配置已保存（模拟）', 'success');
        }
    } catch (error) {
        showToast('保存配置失败', 'error');
    }
}

function updateConfigUI() {
    document.getElementById('gatewayUrl').value = state.config.gateway_url || '';
    document.getElementById('authToken').value = state.config.auth_token || '';
    renderListenList();
}

// ============================================
// Token 管理
// ============================================

async function generateToken() {
    try {
        var token;
        if (window.pywebview && window.pywebview.api) {
            token = await window.pywebview.api.generate_token();
        } else {
            token = generateUUID();
        }
        document.getElementById('authToken').value = token;
        state.config.auth_token = token;
        showToast('Token 已生成', 'success');
        addLog('info', '已生成新的认证 Token');
    } catch (error) {
        showToast('生成 Token 失败', 'error');
    }
}

async function copyToken() {
    var token = document.getElementById('authToken').value;
    if (!token) {
        showToast('Token 为空', 'warning');
        return;
    }
    try {
        await navigator.clipboard.writeText(token);
        showToast('Token 已复制', 'success');
    } catch (error) {
        var input = document.getElementById('authToken');
        input.type = 'text';
        input.select();
        document.execCommand('copy');
        input.type = 'password';
        showToast('Token 已复制', 'success');
    }
}

function toggleTokenVisibility() {
    var input = document.getElementById('authToken');
    var icon = document.getElementById('tokenVisibilityIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '🙈';
    } else {
        input.type = 'password';
        icon.textContent = '👁';
    }
}

// ============================================
// 连接测试
// ============================================

async function testConnection() {
    var url = document.getElementById('gatewayUrl').value.trim();
    if (!url) {
        showToast('请输入 Gateway 地址', 'warning');
        return;
    }

    addLog('info', '正在测试连接: ' + url);
    updateStatus('connecting', '连接中...');

    try {
        if (window.pywebview && window.pywebview.api) {
            var result = await window.pywebview.api.test_connection(url);
            if (result.success) {
                showToast('连接成功', 'success');
                addLog('success', 'Gateway 连接测试成功');
                updateStatus('connected', '连接正常');
            } else {
                showToast('连接失败: ' + result.error, 'error');
                addLog('error', '连接测试失败: ' + result.error);
                updateStatus('error', '连接失败');
            }
        } else {
            await delay(1000);
            showToast('连接成功（模拟）', 'success');
            addLog('success', 'Gateway 连接测试成功（模拟）');
            updateStatus('connected', '连接正常');
        }
    } catch (error) {
        showToast('连接测试失败', 'error');
        addLog('error', '连接测试异常: ' + error.message);
        updateStatus('error', '连接失败');
    }
}

// ============================================
// 监听列表管理
// ============================================

function switchTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.tab').forEach(function(el) {
        el.classList.toggle('active', el.dataset.tab === tab);
    });
    renderListenList();
}

function renderListenList() {
    var container = document.getElementById('listenList');
    var chats = state.config.listen_chats || [];

    // 标准化数据格式（兼容字符串和对象）
    chats = chats.map(function(c) {
        if (typeof c === 'string') {
            return { name: c, type: 'friend', enabled: true };
        }
        return c;
    });

    // 按标签页过滤
    if (state.currentTab !== 'all') {
        chats = chats.filter(function(c) { return c.type === state.currentTab; });
    }

    // 排序：勾选的排在前面
    chats.sort(function(a, b) {
        if (a.enabled && !b.enabled) return -1;
        if (!a.enabled && b.enabled) return 1;
        return 0;
    });

    container.innerHTML = '';

    if (chats.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><p>暂无监听项</p><p class="empty-hint">点击"从微信获取"或手动添加</p></div>';
        return;
    }

    chats.forEach(function(chat) {
        var item = document.createElement('div');
        item.className = 'listen-item' + (chat.enabled ? ' enabled' : '');
        var checkedAttr = chat.enabled ? 'checked' : '';
        var typeLabel = chat.type === 'friend' ? '好友' : '群聊';
        item.innerHTML = '<input type="checkbox" ' + checkedAttr + ' onchange="toggleListenChat(\'' + escapeHtml(chat.name) + '\', this.checked)">' +
            '<span class="listen-item-name">' + escapeHtml(chat.name) + '</span>' +
            '<span class="listen-item-type ' + chat.type + '">' + typeLabel + '</span>' +
            '<button class="listen-item-delete" onclick="removeListenChat(\'' + escapeHtml(chat.name) + '\')" title="删除">✕</button>';
        container.appendChild(item);
    });
}

async function fetchContacts() {
    addLog('info', '正在从微信获取联系人列表...');

    try {
        if (window.pywebview && window.pywebview.api) {
            var result = await window.pywebview.api.fetch_contacts();
            if (result.success) {
                var friends = result.data.friends || [];
                var groups = result.data.groups || [];
                var existingNames = new Set(state.config.listen_chats.map(function(c) { return c.name; }));

                friends.forEach(function(name) {
                    if (!existingNames.has(name)) {
                        state.config.listen_chats.push({ name: name, type: 'friend', enabled: false });
                    }
                });
                groups.forEach(function(name) {
                    if (!existingNames.has(name)) {
                        state.config.listen_chats.push({ name: name, type: 'group', enabled: false });
                    }
                });

                renderListenList();
                showToast('获取成功: ' + friends.length + ' 好友, ' + groups.length + ' 群聊', 'success');
                addLog('success', '从微信获取: ' + friends.length + ' 好友, ' + groups.length + ' 群聊');
            } else {
                showToast('获取失败: ' + result.error, 'error');
                addLog('error', '获取联系人失败: ' + result.error);
            }
        } else {
            await delay(1000);
            var mockFriends = ['张三', '李四', '王五'];
            var mockGroups = ['工作群', '家庭群', '朋友群'];
            var existingNames = new Set(state.config.listen_chats.map(function(c) { return c.name; }));

            mockFriends.forEach(function(name) {
                if (!existingNames.has(name)) {
                    state.config.listen_chats.push({ name: name, type: 'friend', enabled: false });
                }
            });
            mockGroups.forEach(function(name) {
                if (!existingNames.has(name)) {
                    state.config.listen_chats.push({ name: name, type: 'group', enabled: false });
                }
            });

            renderListenList();
            showToast('获取成功（模拟数据）', 'success');
            addLog('success', '从微信获取联系人（模拟）');
        }
    } catch (error) {
        showToast('获取联系人失败', 'error');
        addLog('error', '获取联系人异常: ' + error.message);
    }
}

function showAddDialog() {
    document.getElementById('addModal').classList.add('show');
    document.getElementById('addName').value = '';
    document.getElementById('addName').focus();
}

function hideAddDialog() {
    document.getElementById('addModal').classList.remove('show');
}

async function addListenChat() {
    var name = document.getElementById('addName').value.trim();
    var type = document.querySelector('input[name="addType"]:checked').value;

    if (!name) {
        showToast('请输入名称', 'warning');
        return;
    }

    if (state.config.listen_chats.some(function(c) { return c.name === name; })) {
        showToast('该名称已存在', 'warning');
        return;
    }

    state.config.listen_chats.push({ name: name, type: type, enabled: true });
    renderListenList();
    hideAddDialog();
    showToast('已添加监听', 'success');
    addLog('info', '已添加监听: ' + name + ' (' + (type === 'friend' ? '好友' : '群聊') + ')');
}

async function removeListenChat(name) {
    state.config.listen_chats = state.config.listen_chats.filter(function(c) { return c.name !== name; });
    renderListenList();
    showToast('已移除监听', 'success');
    addLog('info', '已移除监听: ' + name);
}

async function toggleListenChat(name, enabled) {
    var chat = state.config.listen_chats.find(function(c) { return c.name === name; });
    if (chat) {
        chat.enabled = enabled;
        addLog('info', name + ': ' + (enabled ? '已启用' : '已禁用'));
    }
}

// ============================================
// 桥接控制
// ============================================

async function startBridge() {
    await saveConfig();
    addLog('info', '正在启动桥接...');
    updateStatus('connecting', '启动中...');

    try {
        if (window.pywebview && window.pywebview.api) {
            var result = await window.pywebview.api.start_bridge();
            if (result.success) {
                state.isRunning = true;
                updateBridgeButtons();
                showToast('桥接已启动', 'success');
                addLog('success', '桥接启动成功');
                updateStatus('connected', '运行中');
            } else {
                showToast('启动失败: ' + result.error, 'error');
                addLog('error', '桥接启动失败: ' + result.error);
                updateStatus('error', '启动失败');
            }
        } else {
            await delay(1500);
            state.isRunning = true;
            updateBridgeButtons();
            showToast('桥接已启动（模拟）', 'success');
            addLog('success', '桥接启动成功（模拟）');
            updateStatus('connected', '运行中');
        }
    } catch (error) {
        showToast('启动桥接失败', 'error');
        addLog('error', '启动桥接异常: ' + error.message);
        updateStatus('error', '启动失败');
    }
}

async function stopBridge() {
    addLog('info', '正在停止桥接...');

    try {
        if (window.pywebview && window.pywebview.api) {
            var result = await window.pywebview.api.stop_bridge();
            if (result.success) {
                state.isRunning = false;
                updateBridgeButtons();
                showToast('桥接已停止', 'success');
                addLog('info', '桥接已停止');
                updateStatus('disconnected', '已停止');
            } else {
                showToast('停止失败: ' + result.error, 'error');
                addLog('error', '桥接停止失败: ' + result.error);
            }
        } else {
            await delay(500);
            state.isRunning = false;
            updateBridgeButtons();
            showToast('桥接已停止（模拟）', 'success');
            addLog('info', '桥接已停止（模拟）');
            updateStatus('disconnected', '已停止');
        }
    } catch (error) {
        showToast('停止桥接失败', 'error');
        addLog('error', '停止桥接异常: ' + error.message);
    }
}

function updateBridgeButtons() {
    document.getElementById('startBtn').disabled = state.isRunning;
    document.getElementById('stopBtn').disabled = !state.isRunning;
}

// ============================================
// 日志管理
// ============================================

async function loadHistoryLogs() {
    try {
        if (window.pywebview && window.pywebview.api) {
            var logs = await window.pywebview.api.get_history_logs();
            if (logs && logs.length > 0) {
                console.log('[App] 加载历史日志: ' + logs.length + ' 条');
                logs.forEach(function(log) {
                    // 从 timestamp 中提取时间部分
                    var time = log.timestamp ? log.timestamp.split(' ')[1] : new Date().toTimeString().split(' ')[0];
                    state.logs.push({ time: time, level: log.level, content: log.content });
                });
                // 保持日志数量限制
                if (state.logs.length > state.maxLogs) {
                    state.logs = state.logs.slice(-state.maxLogs);
                }
                renderLogs();
            }
        }
    } catch (error) {
        console.error('[App] 加载历史日志失败:', error);
    }
}

function addLog(level, content) {
    var time = new Date().toTimeString().split(' ')[0];
    state.logs.push({ time: time, level: level, content: content });
    if (state.logs.length > state.maxLogs) state.logs.shift();
    renderLogs();
}

function renderLogs() {
    var container = document.getElementById('logContainer');
    if (state.logs.length === 0) {
        container.innerHTML = '<div class="log-empty"><span class="log-empty-icon">📋</span><p>暂无日志</p></div>';
        return;
    }

    var html = '';
    var icons = { 'info': 'ℹ', 'success': '✓', 'warning': '⚠', 'error': '✕', 'message': '💬' };

    for (var i = 0; i < state.logs.length; i++) {
        var log = state.logs[i];
        html += '<div class="log-entry"><span class="log-time">' + log.time + '</span>' +
            '<span class="log-level ' + log.level + '">' + (icons[log.level] || 'ℹ') + '</span>' +
            '<span class="log-content">' + escapeHtml(log.content) + '</span></div>';
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function clearLogs() {
    state.logs = [];
    renderLogs();
    showToast('日志已清空', 'info');
}

window.appendLog = function(level, content) { addLog(level, content); };

// ============================================
// 状态更新
// ============================================

function updateStatus(status, text) {
    var dot = document.getElementById('statusDot');
    var textEl = document.getElementById('statusText');
    dot.classList.remove('connected', 'connecting', 'error');
    if (status === 'connected') dot.classList.add('connected');
    else if (status === 'connecting') dot.classList.add('connecting');
    else if (status === 'error') dot.classList.add('error');
    textEl.textContent = text;
}

window.updateConnectionStatus = function(status, text) { updateStatus(status, text); };

function updateUI() {
    updateConfigUI();
    updateBridgeButtons();
    renderLogs();
}

// ============================================
// Toast 提示
// ============================================

function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    var icons = { 'success': '✓', 'error': '✕', 'warning': '⚠', 'info': 'ℹ' };

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<span class="toast-icon">' + icons[type] + '</span><span class="toast-message">' + escapeHtml(message) + '</span>';
    container.appendChild(toast);

    setTimeout(function() {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// ============================================
// 工具函数
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function generateUUID() {
    return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, function() {
        return Math.floor(Math.random() * 16).toString(16);
    });
}

function delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}
