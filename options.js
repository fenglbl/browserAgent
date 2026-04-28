// Options Page - Native JS Logic (CSP Compliant)

document.addEventListener('DOMContentLoaded', () => {
  const dom = {
    apiKey: document.getElementById('apiKey'),
    baseUrl: document.getElementById('baseUrl'),
    model: document.getElementById('model'),
    saveBtn: document.getElementById('saveBtn'),
    saveStatus: document.getElementById('saveStatus'),
    logContainer: document.getElementById('logContainer'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    toolsGrid: document.getElementById('toolsGrid'),
    logBadge: document.getElementById('logBadge'),
    messageList: document.getElementById('messageList'),
    messageDetail: document.getElementById('messageDetail'),
    refreshMessagesBtn: document.getElementById('refreshMessagesBtn'),
    tabs: document.querySelectorAll('.tab-btn'),
    panels: {
      settings: document.getElementById('settingsPanel'),
      logs: document.getElementById('logsPanel'),
      messages: document.getElementById('messagesPanel'),
      about: document.getElementById('aboutPanel')
    }
  };

  const state = {
    messages: [],
    selectedMessageId: null
  };

  init();

  function init() {
    loadSettings();
    loadTools();
    loadLogs();
    loadMessages();
    bindEvents();

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'AGENT_LOG') {
        addLogToUI(message.payload.msg, message.payload.type);
      }
    });
  }

  function bindEvents() {
    dom.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
      });
    });

    dom.saveBtn.addEventListener('click', saveSettings);
    dom.clearLogsBtn.addEventListener('click', clearLogs);
    dom.refreshMessagesBtn.addEventListener('click', loadMessages);
  }

  function switchTab(tabName) {
    dom.tabs.forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    Object.keys(dom.panels).forEach((key) => {
      dom.panels[key].classList.toggle('active', key === tabName);
    });

    if (tabName === 'logs') {
      dom.logBadge.style.display = 'none';
    }
  }

  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get(['apiKey', 'baseUrl', 'model']);
      if (result.apiKey) dom.apiKey.value = result.apiKey;
      if (result.baseUrl) dom.baseUrl.value = result.baseUrl;
      if (result.model) dom.model.value = result.model;
    } catch (e) {
      console.error('Load settings failed', e);
    }
  }

  async function saveSettings() {
    const apiKey = dom.apiKey.value.trim();
    const baseUrl = dom.baseUrl.value.trim();
    const model = dom.model.value.trim();

    if (!apiKey || !baseUrl) {
      showSaveStatus('❌ API Key 和 Base URL 不能为空', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ apiKey, baseUrl, model });
      showSaveStatus('✅ 设置已保存！', 'success');
      addLogToUI('设置已保存', 'success');
    } catch (e) {
      showSaveStatus('❌ 保存失败: ' + e.message, 'error');
    }
  }

  function showSaveStatus(msg, type) {
    dom.saveStatus.textContent = msg;
    dom.saveStatus.className = `status-msg ${type}`;
    dom.saveStatus.style.display = 'block';
    setTimeout(() => {
      dom.saveStatus.style.display = 'none';
    }, 3000);
  }

  async function loadTools() {
    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_TOOLS' }, resolve);
      });

      if (resp && resp.tools) {
        renderTools(resp.tools);
      } else {
        renderTools({});
      }
    } catch (e) {
      console.error('Load tools failed', e);
    }
  }

  function renderTools(tools) {
    dom.toolsGrid.innerHTML = '';

    const defaultTools = {
      open_url: { description: '打开网址' },
      click_element: { description: '点击元素' },
      type_text: { description: '输入文字' },
      extract_text: { description: '提取内容' },
      get_tab_list: { description: '获取标签列表' }
    };

    const list = Object.keys(tools).length ? tools : defaultTools;

    Object.entries(list).forEach(([name, tool]) => {
      const card = document.createElement('div');
      card.className = 'tool-card';
      card.innerHTML = `
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(tool.description || '无描述')}</p>
      `;
      dom.toolsGrid.appendChild(card);
    });
  }

  async function loadLogs() {
    try {
      const result = await chrome.storage.local.get('agentLogs');
      const logs = result.agentLogs || [];
      renderLogs(logs);
    } catch (e) {
      console.error('Load logs failed', e);
    }
  }

  function renderLogs(logs) {
    dom.logContainer.innerHTML = '';

    if (logs.length === 0) {
      dom.logContainer.innerHTML = '<div style="color:#666; text-align:center; margin-top:50px;">暂无日志</div>';
      dom.logBadge.style.display = 'none';
      return;
    }

    logs.forEach((log) => {
      const div = document.createElement('div');
      div.className = `log-entry ${log.type}`;
      div.innerHTML = `
        <span class="log-time">[${escapeHtml(log.time)}]</span>
        <span class="log-msg">${escapeHtml(log.msg)}</span>
      `;
      dom.logContainer.appendChild(div);
    });

    const count = logs.filter((l) => l.type === 'error').length;
    if (count > 0) {
      dom.logBadge.textContent = count;
      dom.logBadge.style.display = 'inline-block';
    } else {
      dom.logBadge.style.display = 'none';
    }
  }

  function addLogToUI() {
    loadLogs();
  }

  async function clearLogs() {
    try {
      await chrome.storage.local.set({ agentLogs: [] });
      renderLogs([]);
    } catch (e) {
      console.error('Clear logs failed', e);
    }
  }

  async function loadMessages() {
    try {
      const result = await chrome.storage.local.get('agentTaskHistory');
      const history = Array.isArray(result.agentTaskHistory) ? result.agentTaskHistory : [];
      state.messages = history.slice().sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
      if (!state.selectedMessageId && state.messages.length) {
        state.selectedMessageId = state.messages[0].id;
      }
      renderMessages();
      renderMessageDetail();
    } catch (e) {
      console.error('Load messages failed', e);
    }
  }

  function renderMessages() {
    dom.messageList.innerHTML = '';

    if (!state.messages.length) {
      dom.messageList.innerHTML = '<div class="message-empty">暂无会话消息。这里会显示最近的任务记录、状态和结果。</div>';
      dom.messageDetail.className = 'message-detail-empty';
      dom.messageDetail.innerHTML = '点左侧一条记录，就能像会话一样看到完整详情。';
      return;
    }

    state.messages.forEach((item) => {
      const card = document.createElement('div');
      card.className = `message-card ${item.id === state.selectedMessageId ? 'active' : ''}`;
      card.addEventListener('click', () => {
        state.selectedMessageId = item.id;
        renderMessages();
        renderMessageDetail();
      });
      card.innerHTML = `
        <div class="message-meta">
          <span>${escapeHtml(item.time || '')}</span>
          <span>${escapeHtml(item.status || 'idle')}</span>
        </div>
        <div class="message-title">${escapeHtml(item.command || '未命名任务')}</div>
        <div class="message-result">${escapeHtml(item.finalResult || item.summary || '暂无结果')}</div>
      `;
      dom.messageList.appendChild(card);
    });
  }

  function renderMessageDetail() {
    if (!state.messages.length) return;

    const item = state.messages.find((msg) => msg.id === state.selectedMessageId) || state.messages[0];
    if (!item) return;

    const statusClass = (item.status || 'idle').toLowerCase();
    const steps = Array.isArray(item.queue) ? item.queue : [];
    const results = Array.isArray(item.results) ? item.results : [];
    const logs = Array.isArray(item.logs) ? item.logs : [];

    dom.messageDetail.className = 'message-detail';
    dom.messageDetail.innerHTML = `
      <div class="message-detail-header">
        <div>
          <div class="message-detail-title">${escapeHtml(item.command || '未命名任务')}</div>
          <div class="message-detail-subtitle">${escapeHtml(item.time || '')} · 执行轮数 ${escapeHtml(String(item.turns || 0))} · ${escapeHtml(item.id || '')}</div>
        </div>
        <div class="message-detail-badge ${statusClass}">${escapeHtml(item.status || 'idle')}</div>
      </div>

      <div class="detail-grid">
        <div class="detail-chip">
          <div class="detail-chip-label">最终结果</div>
          <div class="detail-chip-value markdown-content">${renderMarkdown(item.finalResult || '暂无')}</div>
        </div>
        <div class="detail-chip">
          <div class="detail-chip-label">摘要</div>
          <div class="detail-chip-value markdown-content">${renderMarkdown(item.summary || '暂无')}</div>
        </div>
        <div class="detail-chip">
          <div class="detail-chip-label">步骤数</div>
          <div class="detail-chip-value">${steps.length}</div>
        </div>
        <div class="detail-chip">
          <div class="detail-chip-label">结果数</div>
          <div class="detail-chip-value">${results.length}</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">执行步骤</div>
        ${steps.length ? `<div class="detail-list">${steps.map((step, index) => `
          <div class="detail-item">
            <div class="detail-item-meta">
              <span>#${index + 1}</span>
              <span>${escapeHtml(step.tool || '')}</span>
            </div>
            <div class="detail-item-title">${escapeHtml(step.desc || step.tool || '未知步骤')}</div>
            <div>${escapeHtml(JSON.stringify(step.args || []))}</div>
          </div>
        `).join('')}</div>` : '<div class="detail-box">暂无步骤记录。</div>'}
      </div>

      <div class="detail-section">
        <div class="detail-section-title">工具结果</div>
        ${results.length ? `<div class="detail-list">${results.map((result, index) => `
          <div class="detail-item">
            <div class="detail-item-meta">
              <span>#${index + 1}</span>
              <span>${result.success ? 'success' : 'error'}</span>
            </div>
            <div class="detail-item-title">${escapeHtml(result.originalTool || result.tool || 'unknown')}</div>
            <div class="markdown-content">${renderMarkdown(result.message || result.error || stringifySafe(result.result || {}))}</div>
          </div>
        `).join('')}</div>` : '<div class="detail-box">暂无工具结果。</div>'}
      </div>

      <div class="detail-section">
        <div class="detail-section-title">会话日志</div>
        ${logs.length ? `<div class="detail-box markdown-content">${renderMarkdown(logs.join('\n'))}</div>` : '<div class="detail-box">暂无日志。</div>'}
      </div>
    `;
  }

  function renderMarkdown(text) {
    const source = String(text || '').replace(/\r\n/g, '\n');
    if (!source.trim()) return '';

    let html = escapeHtml(source);

    html = html.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}>${code.replace(/^[\n\s]+|[\n\s]+$/g, '')}</code></pre>`;
    });

    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^---$/gm, '<hr />');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');

    const lines = html.split('\n');
    let inUl = false;
    let inOl = false;
    const out = [];

    const closeLists = () => {
      if (inUl) out.push('</ul>');
      if (inOl) out.push('</ol>');
      inUl = false;
      inOl = false;
    };

    for (const line of lines) {
      const ulMatch = line.match(/^\s*[-*]\s+(.+)$/);
      const olMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
      if (ulMatch) {
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push(`<li>${ulMatch[1]}</li>`);
        continue;
      }
      if (olMatch) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol>'); inOl = true; }
        out.push(`<li>${olMatch[2]}</li>`);
        continue;
      }
      closeLists();
      if (!line.trim()) {
        out.push('');
      } else if (/^<h[1-3]>|^<blockquote>|^<pre>|^<hr \/>$/.test(line)) {
        out.push(line);
      } else {
        out.push(`<p>${line}</p>`);
      }
    }
    closeLists();

    return out.join('\n')
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<h[1-3]>|<blockquote>|<pre>|<hr \/>|<ul>|<ol>)/g, '$1')
      .replace(/(<\/ul>|<\/ol>|<\/pre>|<\/blockquote>|<\/h[1-3]>)<\/p>/g, '$1');
  }

  function stringifySafe(value) {
    try {
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
