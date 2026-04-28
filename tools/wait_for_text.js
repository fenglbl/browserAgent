import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';
import {
  buildWaitForTextSummary,
  buildWaitForTextTimeoutResult,
  normalizeWaitForTextArgs,
  shouldStopWaitingForText
} from './wait_for_text_core.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForText(text, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'wait_for_text', error: '无法获取当前标签页' });
  }

  const normalized = normalizeWaitForTextArgs({ text, ...options });
  if (!normalized.text) {
    return createToolErrorResult({ tool: 'wait_for_text', error: '缺少 text' });
  }

  const startedAt = Date.now();
  let pollCount = 0;
  let lastMatch = { found: false, count: 0, matches: [] };

  while (true) {
    pollCount += 1;

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: (input) => {
        function normalizeText(value) {
          return (value || '').replace(/\s+/g, ' ').trim();
        }

        function isVisible(el) {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        }

        const target = input.caseSensitive ? String(input.text || '').trim() : String(input.text || '').trim().toLowerCase();
        const bodyText = normalizeText(document.body?.innerText || document.documentElement?.innerText || '');
        const haystack = input.caseSensitive ? bodyText : bodyText.toLowerCase();
        const matches = [];

        if (target && haystack.includes(target)) {
          matches.push({
            text: target,
            tagName: 'BODY',
            id: document.body?.id || '',
            snippet: bodyText.slice(0, 180)
          });
        }

        if (matches.length === 0) {
          const candidates = Array.from(document.querySelectorAll('body, main, article, section, div, p, span, h1, h2, h3, h4, h5, h6, li, a, button, label'));
          for (const el of candidates) {
            if (!isVisible(el)) continue;
            const text = normalizeText(el.innerText || el.textContent || el.getAttribute?.('aria-label') || '');
            const hay = input.caseSensitive ? text : text.toLowerCase();
            if (!target) continue;
            if (!hay.includes(target)) continue;
            matches.push({
              text,
              tagName: el.tagName || '',
              id: el.id || '',
              snippet: text.slice(0, 180)
            });
            if (matches.length >= input.maxMatches) break;
          }
        }

        return {
          success: true,
          data: {
            found: matches.length > 0,
            count: matches.length,
            matches
          }
        };
      },
      args: [normalized]
    });

    const mergedMatches = [];
    for (const item of results || []) {
      const frameMatches = item?.result?.data?.matches || [];
      mergedMatches.push(...frameMatches);
    }
    lastMatch = {
      found: mergedMatches.length > 0,
      count: mergedMatches.length,
      matches: mergedMatches.slice(0, normalized.maxMatches)
    };

    const elapsedMs = Date.now() - startedAt;
    const decision = shouldStopWaitingForText({
      elapsedMs,
      timeoutMs: normalized.timeoutMs,
      result: lastMatch
    });

    if (decision.done && decision.success) {
      const summary = buildWaitForTextSummary({
        text: normalized.text,
        elapsedMs,
        pollCount,
        match: lastMatch
      });
      return createToolSuccessResult({
        tool: 'wait_for_text',
        message: summary.message,
        data: summary.data,
        meta: { elapsedMs, pollCount }
      });
    }

    if (decision.done) {
      const timeoutResult = buildWaitForTextTimeoutResult({
        text: normalized.text,
        elapsedMs,
        pollCount,
        lastMatch
      });
      return createToolErrorResult({
        tool: 'wait_for_text',
        error: timeoutResult.error,
        data: timeoutResult.data,
        meta: { elapsedMs, pollCount }
      });
    }

    await sleep(normalized.intervalMs);
  }
}
