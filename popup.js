// Browser Agent - Popup Chat UI

document.addEventListener('DOMContentLoaded', () => {
  const els = {
    configAlert: document.getElementById('configAlert'),
    configLink: document.getElementById('configLink'),
    chatArea: document.getElementById('chatArea'),
    commandInput: document.getElementById('commandInput'),
    sendBtn: document.getElementById('sendBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    clearBtn: document.getElementById('clearBtn'),
    statusBar: document.getElementById('statusBar'),
    statusSpinner: document.getElementById('statusSpinner'),
    statusText: document.getElementById('statusText'),
    tabDisplay: document.getElementById('tabDisplay')
  };

  const state = {
    isConfigured: false,
    isRunning: false,
    conversationLoaded: false,
    pendingUserMsg: null, // temporary user bubble id while task runs
    thinkingBubbleId: null // temporary thinking indicator id
  };

  let statusTimer = null;
  let messageCount = 0;

  init();

  function init() {
    checkConfig();
    updateCurrentTab();
    bindEvents();
    loadConversation();
    statusTimer = setInterval(loadConversation, 3000);

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TASK_UPDATE' && message.payload) {
        onTaskUpdate(message.payload);
      }
    });
  }

  // ── Config ──

  async function checkConfig() {
    try {
      const result = await chrome.storage.local.get(['apiKey', 'baseUrl']);
      state.isConfigured = !!(result.apiKey && result.baseUrl);
      updateInputState();
    } catch {
      state.isConfigured = false;
      updateInputState();
    }
  }

  function updateInputState() {
    const canUse = state.isConfigured && !state.isRunning;
    els.configAlert.classList.toggle('show', !state.isConfigured);
    els.commandInput.disabled = !canUse;
    els.sendBtn.disabled = !canUse;
  }

  // ── Tab ──

  async function updateCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      els.tabDisplay.textContent = tab?.title ? tab.title.slice(0, 12) + '...' : '无标签页';
    } catch {
      els.tabDisplay.textContent = '获取失败';
    }
  }

  // ── Events ──

  function bindEvents() {
    els.settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    els.configLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    els.clearBtn.addEventListener('click', clearConversation);
    els.sendBtn.addEventListener('click', sendMessage);
    els.commandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    // Auto-resize input
    els.commandInput.addEventListener('input', () => {
      els.commandInput.style.height = '36px';
      els.commandInput.style.height = Math.min(els.commandInput.scrollHeight, 72) + 'px';
    });
    window.addEventListener('unload', () => {
      if (statusTimer) clearInterval(statusTimer);
    });
  }

  // ── Conversation ──

  async function loadConversation() {
    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_CONVERSATION' }, resolve);
      });
      if (resp && resp.success && Array.isArray(resp.messages)) {
        const prevCount = messageCount;
        messageCount = resp.messages.length;
        state.conversationLoaded = true;
        renderConversation(resp.messages);
      }
    } catch {
      // ignore
    }
  }

  async function clearConversation() {
    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CLEAR_CONVERSATION' }, resolve);
      });
      // Also reset task state
      chrome.runtime.sendMessage({ type: 'RESET_TASK' });
      messageCount = 0;
      state.conversationLoaded = false;
      state.isRunning = false;
      state.pendingUserMsg = null;
      state.thinkingBubbleId = null;
      renderEmptyState();
      setStatus('就绪');
      updateInputState();
    } catch {
      // ignore
    }
  }

  // ── Task Updates ──

  function onTaskUpdate(payload) {
    if (payload.status === 'running') {
      state.isRunning = true;
      setStatus('执行中...', true);
    } else {
      // completed / error / idle: 任务已停止
      state.isRunning = false;
      state.pendingUserMsg = null;
      state.thinkingBubbleId = null;
      if (payload.status === 'completed') {
        setStatus('已完成');
        loadConversation();
      } else if (payload.status === 'error') {
        setStatus('执行失败', false, true);
        loadConversation();
      }
    }

    updateInputState();
  }

  // ── Send Message ──

  async function sendMessage() {
    const command = els.commandInput.value.trim();
    if (!command || !state.isConfigured || state.isRunning) return;

    els.commandInput.value = '';
    els.commandInput.style.height = '36px';

    // Show temporary user message
    state.pendingUserMsg = addUserBubble(command);
    addThinkingBubble();

    setStatus('执行中...', true);
    state.isRunning = true;
    updateInputState();

    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'RUN_COMMAND', command }, resolve);
      });
      if (!resp || !resp.success) {
        throw new Error(resp?.error || '启动失败');
      }
    } catch (error) {
      setStatus(`❌ ${error.message}`, false, true);
      state.isRunning = false;
      removeThinkingBubble();
      updateInputState();
    }
  }

  // ── Render ──

  function renderEmptyState() {
    els.chatArea.innerHTML = `
      <div class="chat-empty">
        <div class="icon">🐙</div>
        <div>输入指令让我帮你操作浏览器</div>
        <div class="hint">例如：「打开百度搜索天气」<br>「帮我总结这个页面」<br>「在 GitHub 上找到 OpenClaw」</div>
      </div>
    `;
  }

  function renderConversation(messages) {
    // Skip if we have temporary elements and no real messages
    if (!messages || messages.length === 0) {
      renderEmptyState();
      return;
    }

    // Build display items from conversation messages
    const items = buildDisplayItems(messages);
    renderDisplayItems(items);
  }

  function buildDisplayItems(messages) {
    const items = [];
    let currentAssistant = null;

    for (const msg of messages) {
      // Skip system messages (both the prompt and compressed summaries)
      if (msg.role === 'system') continue;
      // Skip tool result messages (internal to model)
      if (msg.role === 'tool') continue;

      if (msg.role === 'user') {
        // Flush any pending assistant
        if (currentAssistant) {
          items.push({ type: 'assistant', content: currentAssistant.content, steps: currentAssistant.steps });
          currentAssistant = null;
        }
        items.push({ type: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Tool call messages: accumulate steps, ignore the content
          if (!currentAssistant) {
            currentAssistant = { content: '', steps: [] };
          }
          for (const tc of msg.tool_calls) {
            const fn = tc.function || tc;
            const name = fn.name || '';
            let args = [];
            try {
              const raw = typeof fn.arguments === 'string' ? fn.arguments : '[]';
              args = JSON.parse(raw);
              if (!Array.isArray(args)) args = Object.values(args);
            } catch { args = []; }
            currentAssistant.steps.push({ name, args });
          }
        } else if (msg.content) {
          // Final response from assistant
          if (currentAssistant) {
            currentAssistant.content = msg.content;
          } else {
            items.push({ type: 'assistant', content: msg.content, steps: [] });
          }
        }
      }
    }

    // Flush last assistant
    if (currentAssistant) {
      items.push({ type: 'assistant', content: currentAssistant.content, steps: currentAssistant.steps });
    }

    return items;
  }

  function renderDisplayItems(items) {
    // Clear existing messages, preserve temporary ones if they exist
    const tempUser = state.pendingUserMsg ? els.chatArea.querySelector(`[data-temp-user]`) : null;
    const tempThink = state.thinkingBubbleId ? els.chatArea.querySelector(`[data-temp-think]`) : null;
    els.chatArea.innerHTML = '';

    if (items.length === 0 && !tempUser) {
      renderEmptyState();
      return;
    }

    for (const item of items) {
      if (item.type === 'user') {
        addBubble('user', escapeHtml(item.content));
      } else if (item.type === 'assistant') {
        const stepsHtml = item.steps && item.steps.length > 0
          ? `<div class="tool-steps">${item.steps.map(s => {
              const icon = stepIcon(s.name || s.tool);
              const desc = stepDesc(s);
              return `<div class="tool-step"><span class="icon">${icon}</span><span class="desc">${desc}</span></div>`;
            }).join('')}</div>`
          : '';
        const contentHtml = item.content ? escapeHtml(item.content) : '';
        addBubble('assistant',
          (contentHtml ? `<div>${contentHtml}</div>` : '') +
          (stepsHtml ? stepsHtml : '')
        );
      }
    }

    // Re-add temporary elements
    if (tempUser) {
      els.chatArea.appendChild(tempUser);
    }
    if (tempThink) {
      els.chatArea.appendChild(tempThink);
    }

    scrollToBottom();
  }

  function addBubble(type, html) {
    const div = document.createElement('div');
    div.className = `msg ${type}`;

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = type === 'user' ? '你' : '🤖 助手';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = html;

    div.appendChild(label);
    div.appendChild(bubble);
    els.chatArea.appendChild(div);
    scrollToBottom();
  }

  function addUserBubble(text) {
    const div = document.createElement('div');
    div.className = 'msg user';
    div.setAttribute('data-temp-user', 'true');

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = '你';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    div.appendChild(label);
    div.appendChild(bubble);
    els.chatArea.appendChild(div);
    scrollToBottom();
    return div;
  }

  function addThinkingBubble() {
    const div = document.createElement('div');
    div.className = 'msg assistant';
    div.setAttribute('data-temp-think', 'true');

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = '🤖 助手';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = '<div class="thinking-indicator"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';

    div.appendChild(label);
    div.appendChild(bubble);
    els.chatArea.appendChild(div);
    scrollToBottom();
    state.thinkingBubbleId = div;
    return div;
  }

  function removeThinkingBubble() {
    if (state.thinkingBubbleId) {
      const el = els.chatArea.querySelector('[data-temp-think]');
      if (el) el.remove();
      state.thinkingBubbleId = null;
    }
  }

  function scrollToBottom() {
    els.chatArea.scrollTop = els.chatArea.scrollHeight;
  }

  // ── Status ──

  function setStatus(text, showSpinner = false, isError = false) {
    els.statusText.textContent = text;
    els.statusSpinner.style.display = showSpinner ? 'inline-block' : 'none';
    els.statusText.style.color = isError ? 'var(--error)' : '';
    if (!isError) els.statusText.style.color = '';
  }

  // ── Step Helpers ──

  function stepIcon(name) {
    const map = {
      open_url: '🌐',
      click_element: '🖱️',
      type_text: '⌨️',
      extract_text: '📄',
      find_element: '🔎',
      wait_for_element: '⏳',
      wait_for_navigation: '🧭',
      scroll_into_view: '⬇️',
      press_key: '⌨️',
      screenshot: '📸',
      hover_element: '👆',
      select_option: '📋',
      check_element: '✅',
      wait_for_text: '🔍',
      read_attribute: '🏷️',
      extract_links: '🔗',
      read_storage: '💾',
      wait_for_url_change: '🔄',
      dom_snapshot: '🏗️',
      extract_forms: '📝',
      read_cookie: '🍪',
      wait_for_network_idle: '🌐',
      extract_images: '🖼️',
      upload_file: '📎',
      fill_form: '✏️',
      summarize_text: '📝'
    };
    return map[name] || '🔧';
  }

  function stepDesc(toolCall) {
    const args = toolCall.args || toolCall.arguments || [];
    const firstArg = Array.isArray(args) ? args[0] : (typeof args === 'object' ? Object.values(args)[0] : '');
    switch (toolCall.name || toolCall.tool) {
      case 'open_url': return firstArg ? `打开 ${firstArg}` : '打开网址';
      case 'click_element': return firstArg ? `点击 ${firstArg}` : '点击元素';
      case 'type_text': return firstArg ? `输入文字到 ${firstArg}` : '输入文字';
      case 'extract_text': return '提取文本';
      case 'find_element': return firstArg ? `查找 ${firstArg}` : '查找元素';
      case 'wait_for_element': return firstArg ? `等待 ${firstArg}` : '等待元素';
      case 'wait_for_navigation': return '等待导航';
      case 'scroll_into_view': return firstArg ? `滚动到 ${firstArg}` : '滚动';
      case 'press_key': return firstArg ? `按键 ${firstArg}` : '按键';
      case 'screenshot': return '截图';
      case 'summarize_text': return '总结内容';
      default: return (toolCall.name || toolCall.tool || '');
    }
  }

  // ── Utilities ──

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
