// Browser Agent - Content Script
// 注入到每个页面，负责与页面 DOM 交互 + 页面错误监听

console.log('[BrowserAgent] Content script loaded on:', window.location.href);

function ensurePageErrorMonitor() {
  if (window.__browserAgentContentMonitorInstalled) return;
  window.__browserAgentContentMonitorInstalled = true;

  function send(payload) {
    chrome.runtime.sendMessage({ type: 'PAGE_RUNTIME_EVENT', payload }).catch(() => {});
  }

  window.addEventListener('error', (event) => {
    try {
      const target = event.target;
      const isResource = target && target !== window && (target.src || target.href);
      if (isResource) {
        send({
          kind: 'resource-error',
          url: target.src || target.href || '',
          tagName: target.tagName || '',
          pageUrl: window.location.href,
          title: document.title,
          time: Date.now()
        });
      } else {
        send({
          kind: 'js-error',
          message: event.message || 'Unknown error',
          filename: event.filename || '',
          lineno: event.lineno || 0,
          colno: event.colno || 0,
          pageUrl: window.location.href,
          title: document.title,
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
      send({
        kind: 'unhandledrejection',
        reason,
        pageUrl: window.location.href,
        title: document.title,
        time: Date.now()
      });
    } catch {}
  });
}

ensurePageErrorMonitor();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[BrowserAgent] Content script received:', message);

  if (message.type === 'GET_PAGE_DATA') {
    const data = {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText,
      html: document.body.innerHTML,
      meta: getMetaTags(),
      links: Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText,
        href: a.href
      }))
    };
    sendResponse({ success: true, data });
  }

  if (message.type === 'CLICK_ELEMENT') {
    const selector = message.selector;
    const element = document.querySelector(selector);
    if (element) {
      element.click();
      sendResponse({ success: true, message: `Clicked ${selector}` });
    } else {
      sendResponse({ success: false, error: `Element not found: ${selector}` });
    }
  }

  if (message.type === 'EXTRACT_CONTENT') {
    const main = document.querySelector('main, article, [role="main"], .content, #content') || document.body;
    sendResponse({
      success: true,
      data: {
        title: document.title,
        content: main.innerText,
        url: window.location.href
      }
    });
  }

  return true;
});

function getMetaTags() {
  const metas = document.querySelectorAll('meta');
  const result = {};
  metas.forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    const content = meta.getAttribute('content');
    if (name && content) result[name] = content;
  });
  return result;
}

window.addEventListener('load', () => {
  console.log('[BrowserAgent] Page loaded, notifying background');
  chrome.runtime.sendMessage({
    type: 'PAGE_LOADED',
    url: window.location.href,
    title: document.title
  }).catch(() => {});
});
