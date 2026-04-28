// Browser Agent - Popup Logic (纯 UI 层)

document.addEventListener('DOMContentLoaded', () => {
  const els = {
    configAlert: document.getElementById('configAlert'),
    configLink: document.getElementById('configLink'),
    commandInput: document.getElementById('commandInput'),
    runBtn: document.getElementById('runBtn'),
    btnSpinner: document.getElementById('btnSpinner'),
    btnText: document.getElementById('btnText'),
    statusMsg: document.getElementById('statusMsg'),
    taskTimeline: document.getElementById('taskTimeline'),
    taskSteps: document.getElementById('taskSteps'),
    tabTitle: document.getElementById('tabTitle'),
    settingsBtn: document.getElementById('settingsBtn'),
    resetBtn: document.getElementById('resetBtn')
  };

  const state = {
    isConfigured: false,
    isLoading: false,
    taskQueue: [],
    status: 'idle',
    command: '',
    finalResult: ''
  };

  let statusTimer = null;
  let lastKnownStatus = null;

  init();

  function init() {
    checkConfig();
    updateCurrentTab();
    bindEvents();
    refreshTaskStatus();
    statusTimer = setInterval(refreshTaskStatus, 1000);
  }

  function bindEvents() {
    els.settingsBtn.addEventListener('click', openSettings);
    els.resetBtn.addEventListener('click', resetTask);
    els.configLink.addEventListener('click', (e) => {
      e.preventDefault();
      openSettings();
    });
    els.runBtn.addEventListener('click', startTask);
    els.commandInput.addEventListener('input', (e) => {
      state.command = e.target.value;
      updateUI();
    });
    els.commandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startTask();
      }
    });

    window.addEventListener('unload', () => {
      if (statusTimer) clearInterval(statusTimer);
    });
  }

  async function checkConfig() {
    try {
      const result = await chrome.storage.local.get(['apiKey', 'baseUrl']);
      state.isConfigured = !!(result.apiKey && result.baseUrl);
      updateUI();
    } catch {
      state.isConfigured = false;
      updateUI();
    }
  }

  async function updateCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      els.tabTitle.textContent = tab?.title ? (tab.title.slice(0, 15) + '...') : '无标签页';
    } catch {
      els.tabTitle.textContent = '获取失败';
    }
  }

  function openSettings() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
  }

  async function resetTask(skipConfirm = false) {
    if (!skipConfirm && !confirm('确定要清空当前任务状态吗？')) return;

    try {
      await chrome.storage.local.remove('agentTask');
      state.status = 'idle';
      state.isLoading = false;
      state.taskQueue = [];
      state.finalResult = '';
      els.taskTimeline.classList.remove('show');
      els.taskSteps.innerHTML = '';
      lastKnownStatus = null;
      if (!skipConfirm) showStatus('✅ 状态已重置', 'success');
      updateUI();
      chrome.runtime.sendMessage({ type: 'RESET_TASK' });
    } catch (e) {
      showStatus('❌ 重置失败: ' + e.message, 'error');
    }
  }

  function updateUI() {
    if (!state.isConfigured) {
      els.configAlert.classList.add('show');
      els.commandInput.disabled = true;
      els.runBtn.disabled = true;
      return;
    }

    els.configAlert.classList.remove('show');
    const isBusy = state.isLoading || state.status === 'running';

    if (isBusy) {
      els.btnSpinner.style.display = 'inline-block';
      els.btnText.textContent = '后台运行中...';
      els.commandInput.disabled = true;
      els.runBtn.disabled = true;
      els.runBtn.classList.add('running');
    } else {
      els.btnSpinner.style.display = 'none';
      els.btnText.textContent = '🚀 执行指令';
      els.commandInput.disabled = false;
      els.runBtn.classList.remove('running');
      els.runBtn.disabled = !state.command || !state.command.trim();
    }
  }

  function showStatus(msg, type = 'info') {
    els.statusMsg.textContent = msg;
    els.statusMsg.className = `status-msg show ${type}`;
    if (type === 'info' || type === 'success') {
      setTimeout(() => {
        if (els.statusMsg.textContent === msg) {
          els.statusMsg.classList.remove('show');
        }
      }, 4000);
    }
  }

  function getStepIcon(tool) {
    const map = {
      open_url: '🌐',
      click_element: '🖱️',
      type_text: '⌨️',
      extract_text: '📄',
      get_tab_list: '🗂️',
      summarize_text: '📝',
      find_element: '🔎'
    };
    return map[tool] || '🔧';
  }

  function renderTaskSteps() {
    els.taskSteps.innerHTML = '';
    if (!state.taskQueue || state.taskQueue.length === 0) {
      els.taskTimeline.classList.remove('show');
      return;
    }

    state.taskQueue.forEach((step, index) => {
      const div = document.createElement('div');
      div.className = `task-step ${index === 0 ? 'active' : 'completed'}`;
      div.innerHTML = `
        <span class="icon">${getStepIcon(step.tool)}</span>
        <div class="content">
          <div class="title">${escapeHtml(step.desc || step.tool || '未知步骤')}</div>
          <div class="meta">${escapeHtml(step.tool || '')}</div>
        </div>
      `;
      els.taskSteps.appendChild(div);
    });
    els.taskTimeline.classList.add('show');
  }

  async function refreshTaskStatus() {
    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_TASK_STATUS' }, resolve);
      });

      if (!resp || !resp.success) return;

      const task = resp;
      const now = Date.now();
      const isStale = task.status === 'running' && task.startTime && (now - task.startTime > 8 * 60 * 1000);
      if (isStale) {
        await resetTask(true);
        showStatus('⚠️ 检测到旧任务卡住，已自动重置', 'info');
        return;
      }

      state.taskQueue = Array.isArray(task.queue) ? task.queue : [];
      state.status = task.status || 'idle';
      state.finalResult = task.finalResult || '';

      if (state.status === 'completed' || state.status === 'error' || state.status === 'idle') {
        state.isLoading = false;
        if (state.status !== 'idle' && state.status !== lastKnownStatus) {
          showStatus(task.finalResult || task.logs?.[task.logs.length - 1] || '任务结束', state.status === 'completed' ? 'success' : 'error');
          lastKnownStatus = state.status;
        }
      } else if (state.status === 'running') {
        state.isLoading = true;
      }

      renderTaskSteps();
      updateUI();
    } catch {
      // ignore polling errors
    }
  }

  async function startTask() {
    const command = els.commandInput.value.trim();
    if (!command) return;

    state.command = command;
    state.isLoading = true;
    state.status = 'running';
    state.taskQueue = [];
    state.finalResult = '';
    lastKnownStatus = null;

    showStatus('任务已提交，开始进入 tool loop...', 'info');
    updateUI();
    els.taskTimeline.classList.remove('show');
    els.taskSteps.innerHTML = '';

    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'RUN_COMMAND', command }, resolve);
      });

      if (!resp || !resp.success) {
        throw new Error(resp?.error || '启动失败');
      }

      showStatus('后台开始执行...', 'info');
    } catch (error) {
      state.isLoading = false;
      state.status = 'error';
      showStatus(`❌ ${error.message}`, 'error');
      updateUI();
    }
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
