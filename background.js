// Browser Agent - Background Service Worker
// 标准 tool loop 执行中心

import { runToolLoop, getToolList } from './agent.js';

console.log('[BrowserAgent] Background service worker started');

const CONVERSATION_KEY = 'agentConversation';
const CONVERSATION_MAX_MESSAGES = 200; // 超过此数量触发压缩
const CONVERSATION_KEEP_RECENT = 60;   // 压缩时保留最近的消息数

let currentTask = {
  id: null,
  queue: [],
  currentStep: 0,
  status: 'idle',
  logs: [],
  startTime: null,
  results: [],
  finalResult: null,
  turns: 0,
  command: ''
};

let conversationMessages = [];

async function loadConversation() {
  try {
    const result = await chrome.storage.local.get(CONVERSATION_KEY);
    conversationMessages = Array.isArray(result[CONVERSATION_KEY]) ? result[CONVERSATION_KEY] : [];
  } catch {
    conversationMessages = [];
  }
}

async function saveConversation(messages) {
  const compressed = compressConversationIfNeeded(messages);
  conversationMessages = compressed;
  await chrome.storage.local.set({ [CONVERSATION_KEY]: compressed });
}

async function clearConversation() {
  conversationMessages = [];
  await chrome.storage.local.remove(CONVERSATION_KEY);
}

function buildConversationSummary(messages) {
  const entries = [];
  for (const msg of messages) {
    if (msg.role === 'user' && typeof msg.content === 'string') {
      const text = msg.content.slice(0, 200).trim();
      if (text) entries.push(`用户：${text}`);
    } else if (msg.role === 'assistant' && typeof msg.content === 'string' && !msg.tool_calls) {
      const text = msg.content.slice(0, 200).trim();
      if (text) entries.push(`助手：${text}`);
    }
  }
  return entries.join('\n').slice(0, 4000);
}

function compressConversationIfNeeded(messages) {
  if (messages.length <= CONVERSATION_MAX_MESSAGES) return messages;

  const systemMsg = messages[0];
  const toCompress = messages.slice(1, -CONVERSATION_KEEP_RECENT);
  const recentMessages = messages.slice(-CONVERSATION_KEEP_RECENT);

  const summary = buildConversationSummary(toCompress);
  const compressedMsg = {
    role: 'system',
    content: `[会话压缩摘要] 以下是之前对话的摘要，请基于此继续：\n\n${summary}`
  };

  const compressed = [systemMsg, compressedMsg, ...recentMessages];
  console.log(`[BrowserAgent] 会话已压缩：${messages.length} 条 -> ${compressed.length} 条`);
  return compressed;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[BG] Message received:', message.type);

  if (message.type === 'RUN_COMMAND') {
    startToolLoopTask(message.command)
      .then(() => sendResponse({ success: true, message: '任务已在后台运行' }))
      .catch(async (err) => {
        await addLog(`[执行] 任务启动失败：${err.message}`, 'error');
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.type === 'GET_TASK_STATUS') {
    sendResponse({ success: true, ...currentTask });
    return true;
  }

  if (message.type === 'RESET_TASK') {
    resetCurrentTask();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_TOOLS') {
    sendResponse({ success: true, tools: getToolList() });
    return true;
  }

  if (message.type === 'GET_CONVERSATION') {
    sendResponse({ success: true, messages: conversationMessages });
    return true;
  }

  if (message.type === 'CLEAR_CONVERSATION') {
    await clearConversation();
    sendResponse({ success: true });
    return true;
  }
});

async function resetCurrentTask() {
  currentTask = {
    id: null,
    queue: [],
    currentStep: 0,
    status: 'idle',
    logs: [],
    startTime: null,
    results: [],
    finalResult: null,
    turns: 0,
    command: ''
  };
  await chrome.storage.local.remove('agentTask');
}

async function updateTaskStatus(statusObj) {
  currentTask = { ...currentTask, ...statusObj };
  await chrome.storage.local.set({ agentTask: currentTask });
  chrome.runtime.sendMessage({ type: 'TASK_UPDATE', payload: currentTask }).catch(() => {});
}

async function appendTaskHistory(entry) {
  try {
    const result = await chrome.storage.local.get('agentTaskHistory');
    const history = Array.isArray(result.agentTaskHistory) ? result.agentTaskHistory : [];
    history.unshift(entry);
    await chrome.storage.local.set({ agentTaskHistory: history.slice(0, 20) });
  } catch (e) {
    console.error('History append error', e);
  }
}

function formatClockTime(timestamp = Date.now()) {
  const now = new Date(timestamp);
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

async function addLog(msg, type = 'info') {
  const time = formatClockTime();
  const log = { time, msg, type };
  const result = await chrome.storage.local.get('agentLogs');
  const logs = result.agentLogs || [];
  logs.unshift(log);
  const maxLogs = 100;
  if (logs.length > maxLogs) logs.length = maxLogs;
  await chrome.storage.local.set({ agentLogs: logs });
  chrome.runtime.sendMessage({ type: 'AGENT_LOG', payload: log }).catch(() => {});
  console.log(`[${time}] [${type}]`, msg);
}

function stepDesc(toolCall) {
  const args = toolCall.argsArray || [];
  switch (toolCall.name) {
    case 'open_url':
      return `打开 ${args[0] || '页面'}`;
    case 'click_element':
      return `点击 ${args[0] || '元素'}`;
    case 'type_text':
      return `输入文字到 ${args[0] || '元素'}`;
    case 'wait_for_element':
      return `等待元素 ${args[0] || ''}`.trim();
    case 'wait_for_navigation':
      return '等待页面导航';
    case 'scroll_into_view':
      return `滚动到 ${args[0] || '元素'}`;
    case 'press_key':
      return `按键 ${args[0] || ''}`.trim();
    case 'screenshot':
      return '截图';
    default:
      return `${toolCall.name} ${JSON.stringify(args)}`;
  }
}

async function startToolLoopTask(command) {
  const taskId = Date.now().toString();

  // 确保会话上下文已加载
  await loadConversation();

  await updateTaskStatus({
    id: taskId,
    queue: [],
    currentStep: 0,
    status: 'running',
    logs: [`开始执行任务：${command}`],
    startTime: Date.now(),
    results: [],
    finalResult: null,
    command,
    turns: 0
  });

  await addLog(`[执行] 开始任务：${command}`, 'info');

  try {
    const loopResult = await runToolLoop(command, {
      onBeforeTool: async (toolCall, ctx) => {
        const nextQueue = [{
          tool: toolCall.name,
          args: toolCall.argsArray,
          desc: stepDesc(toolCall)
        }, ...(currentTask.queue || [])];

        await updateTaskStatus({
          queue: nextQueue,
          currentStep: 0,
          turns: ctx.turn + 1,
          logs: [...(currentTask.logs || []), `执行步骤 ${nextQueue.length}: ${stepDesc(toolCall)}`]
        });

        if (toolCall.guardReason) {
          await addLog(`[守卫] ${toolCall.name} 被预处理为 ${toolCall.guardReason}`, 'info');
        }

        await addLog(`[执行] 步骤 ${nextQueue.length} ${toolCall.name} 参数：${JSON.stringify(toolCall.argsArray).slice(0, 1000)}`, 'info');
      },
      onRecovery: async (toolCall, recovery, failedResult) => {
        await addLog(
          `[恢复] ${toolCall.name} 失败：${failedResult?.error || 'unknown'}，改用 ${recovery.toolName}（${recovery.recoveryReason}）`.slice(0, 1600),
          'info'
        );
      },
      onAfterTool: async (toolCall, result, ctx) => {
        const latestStep = ctx.executedSteps?.[ctx.executedSteps.length - 1];
        const nextResults = [...(currentTask.results || []), {
          tool: latestStep?.tool || toolCall.name,
          originalTool: latestStep?.originalTool || toolCall.name,
          args: latestStep?.args || toolCall.argsArray,
          originalArgs: latestStep?.originalArgs || toolCall.argsArray,
          success: !!result?.success,
          result: result?.data || result,
          message: result?.message,
          error: result?.error,
          meta: result?.meta
        }];

        let finalResult = currentTask.finalResult;
        if (result?.success && typeof result.message === 'string' && result.message.trim()) {
          finalResult = result.message;
        }

        await updateTaskStatus({
          results: nextResults,
          finalResult,
          turns: ctx.turn + 1,
          logs: [...(currentTask.logs || []), `${result?.success ? '✓' : '✗'} 步骤 ${nextResults.length} ${result?.success ? '成功' : '失败'}`]
        });
      },
      onFinal: async (final, ctx) => {
        await updateTaskStatus({
          finalResult: final,
          turns: (ctx.turn || 0) + 1,
          logs: [...(currentTask.logs || []), `任务完成：${final}`]
        });
      }
    }, {
      existingMessages: conversationMessages.length > 0 ? conversationMessages : null
    });

    // 保存会话上下文
    if (loopResult.messages && loopResult.messages.length > 0) {
      await saveConversation(loopResult.messages);
    }

    const status = loopResult.success ? 'completed' : 'error';
    const finalText = loopResult.final || currentTask.finalResult;
    await updateTaskStatus({
      status,
      finalResult: finalText,
      turns: loopResult.turns || currentTask.turns,
      logs: [...(currentTask.logs || []), '任务结束']
    });

    await appendTaskHistory({
      id: taskId,
      command,
      status,
      finalResult: finalText,
      summary: currentTask.logs?.[currentTask.logs.length - 1] || '',
      time: formatClockTime(),
      finishedAt: Date.now(),
      turns: loopResult.turns || currentTask.turns,
      queue: currentTask.queue || [],
      results: currentTask.results || [],
      logs: currentTask.logs || []
    });

    await addLog(`[执行] 任务结束，状态：${status}，最终结果：${JSON.stringify(loopResult.final)}`, status === 'completed' ? 'success' : 'error');
  } catch (error) {
    await updateTaskStatus({
      status: 'error',
      finalResult: error.message,
      logs: [...(currentTask.logs || []), `任务失败：${error.message}`]
    });

    await appendTaskHistory({
      id: taskId,
      command,
      status: 'error',
      finalResult: error.message,
      summary: error.message,
      time: formatClockTime(),
      finishedAt: Date.now(),
      turns: currentTask.turns || 0,
      queue: currentTask.queue || [],
      results: currentTask.results || [],
      logs: currentTask.logs || []
    });

    await addLog(`[执行] 任务失败：${error.message}`, 'error');

    // 即使失败也保存会话上下文（错误信息已写入 currentTask 和 loopResult）
    if (currentTask.logs?.length > 0) {
      await saveConversation(conversationMessages);
    }
  }
}
