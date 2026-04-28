// Tool helper: page_monitor
// 在网页操作前后安装监听、收集错误，并做短时观测

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeTabInfo(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return {
      url: tab?.url || '',
      title: tab?.title || ''
    };
  } catch {
    return { url: '', title: '' };
  }
}

export async function installPageMonitor(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        if (window.__browserAgentMonitorInstalled) return;
        window.__browserAgentMonitorInstalled = true;
        window.__browserAgentMonitor = {
          startedAt: Date.now(),
          errors: [],
          rejections: [],
          resources: []
        };

        window.addEventListener('error', (event) => {
          try {
            const target = event.target;
            const isResource = target && target !== window && (target.src || target.href);
            if (isResource) {
              window.__browserAgentMonitor.resources.push({
                type: 'resource',
                tagName: target.tagName || '',
                url: target.src || target.href || '',
                time: Date.now()
              });
            } else {
              window.__browserAgentMonitor.errors.push({
                message: event.message || 'Unknown error',
                filename: event.filename || '',
                lineno: event.lineno || 0,
                colno: event.colno || 0,
                time: Date.now()
              });
            }
          } catch {}
        }, true);

        window.addEventListener('unhandledrejection', (event) => {
          try {
            let reason = '';
            if (typeof event.reason === 'string') reason = event.reason;
            else if (event.reason?.message) reason = event.reason.message;
            else reason = String(event.reason);
            window.__browserAgentMonitor.rejections.push({
              reason,
              time: Date.now()
            });
          } catch {}
        });
      }
    });
    return true;
  } catch {
    return false;
  }
}

export async function observePageAfterAction(tabId, { action = 'unknown', selector = '', waitMs = 6000 } = {}) {
  const before = await safeTabInfo(tabId);
  await installPageMonitor(tabId);
  await sleep(waitMs);
  const after = await safeTabInfo(tabId);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        function normalizeText(text) {
          return (text || '').replace(/\s+/g, ' ').trim();
        }

        function isVisible(el) {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        }

        const monitor = window.__browserAgentMonitor || { errors: [], rejections: [], resources: [] };
        const title = document.title || '';
        const url = window.location.href;
        const bodyText = normalizeText(document.body?.innerText || '').slice(0, 4000);

        const suspiciousSelectors = [
          '[role="alert"]',
          '[aria-live="assertive"]',
          '[aria-invalid="true"]',
          '.error',
          '.alert',
          '.alert-danger',
          '.toast-error',
          '.notification-error',
          '.message-error',
          '.form-error',
          '.is-error',
          '.has-error',
          '.error-message',
          '.ant-message-error',
          '.el-message--error',
          '.MuiAlert-standardError'
        ];

        const keywordPatterns = [
          /错误/g,
          /失败/g,
          /异常/g,
          /无权限/g,
          /不可用/g,
          /error/gi,
          /failed/gi,
          /forbidden/gi,
          /denied/gi,
          /not allowed/gi,
          /unauthorized/gi,
          /invalid/gi
        ];

        const suspiciousTexts = [];
        for (const selector of suspiciousSelectors) {
          for (const el of Array.from(document.querySelectorAll(selector))) {
            if (!isVisible(el)) continue;
            const text = normalizeText(el.innerText || el.textContent || '');
            if (!text) continue;
            const hits = [];
            for (const re of keywordPatterns) {
              const matches = text.match(re);
              if (matches?.length) hits.push({ keyword: re.toString(), count: matches.length });
            }
            if (hits.length) {
              suspiciousTexts.push({
                selector,
                text: text.slice(0, 200),
                hits
              });
            }
          }
        }

        return {
          success: true,
          data: {
            title,
            url,
            errorCount: monitor.errors.length,
            rejectionCount: monitor.rejections.length,
            resourceErrorCount: monitor.resources.length,
            recentErrors: monitor.errors.slice(-5),
            recentRejections: monitor.rejections.slice(-5),
            recentResources: monitor.resources.slice(-5),
            suspiciousTexts: suspiciousTexts.slice(0, 10),
            keywordHits: suspiciousTexts.flatMap(item => item.hits).slice(0, 20),
            textPreview: bodyText.slice(0, 300)
          }
        };
      }
    });

    const frameData = (results || []).map(r => r.result?.data).filter(Boolean);
    const merged = {
      action,
      selector,
      waitMs,
      before,
      after,
      urlChanged: before.url !== after.url,
      titleChanged: before.title !== after.title,
      errorCount: 0,
      rejectionCount: 0,
      resourceErrorCount: 0,
      recentErrors: [],
      recentRejections: [],
      recentResources: [],
      suspiciousTexts: [],
      keywordHits: [],
      hasIssue: false,
      summary: ''
    };

    for (const item of frameData) {
      merged.errorCount += item.errorCount || 0;
      merged.rejectionCount += item.rejectionCount || 0;
      merged.resourceErrorCount += item.resourceErrorCount || 0;
      merged.recentErrors.push(...(item.recentErrors || []));
      merged.recentRejections.push(...(item.recentRejections || []));
      merged.recentResources.push(...(item.recentResources || []));
      merged.suspiciousTexts.push(...(item.suspiciousTexts || []));
      merged.keywordHits.push(...(item.keywordHits || []));
    }

    merged.recentErrors = merged.recentErrors.slice(-10);
    merged.recentRejections = merged.recentRejections.slice(-10);
    merged.recentResources = merged.recentResources.slice(-10);
    merged.suspiciousTexts = merged.suspiciousTexts.slice(0, 10);
    merged.keywordHits = merged.keywordHits.slice(0, 20);
    merged.hasIssue = Boolean(
      merged.errorCount ||
      merged.rejectionCount ||
      merged.resourceErrorCount ||
      merged.suspiciousTexts.length
    );

    merged.summary = merged.hasIssue
      ? `检测到页面异常：error=${merged.errorCount}, rejection=${merged.rejectionCount}, resource=${merged.resourceErrorCount}, suspiciousBlocks=${merged.suspiciousTexts.length}`
      : `监听 ${Math.round(waitMs / 1000)} 秒未发现明显异常`;

    return { success: true, data: merged, message: merged.summary };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
