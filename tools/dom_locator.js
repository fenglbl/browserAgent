// Shared DOM locator for browser-agent tools
// 这个函数会被 chrome.scripting.executeScript 直接注入页面执行，
// 因此必须是自包含的，不能依赖外部闭包。
export function locateDomCandidatesInPage(sel) {
  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function buildPath(el) {
    if (!el || !el.tagName) return '';
    const parts = [];
    let current = el;
    let depth = 0;
    while (current && current.nodeType === 1 && depth < 5) {
      let part = current.tagName.toLowerCase();
      if (current.id) part += `#${current.id}`;
      else if (current.classList?.length) part += '.' + Array.from(current.classList).slice(0, 2).join('.');
      parts.unshift(part);
      current = current.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function collectAllElements(root, out = []) {
    if (!root) return out;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      out.push(node);
      if (node.shadowRoot) collectAllElements(node.shadowRoot, out);
      node = walker.nextNode();
    }
    return out;
  }

  function getOwnText(el) {
    const texts = [];
    for (const node of el.childNodes || []) {
      if (node.nodeType === Node.TEXT_NODE) texts.push(node.textContent || '');
    }
    return normalizeText(texts.join(' '));
  }

  function isInteractive(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (['a', 'button', 'input', 'select', 'textarea', 'summary', 'option', 'label', 'li'].includes(tag)) return true;
    if (el.onclick) return true;
    if (el.hasAttribute?.('onclick')) return true;
    if (el.hasAttribute?.('tabindex')) return true;
    const role = (el.getAttribute?.('role') || '').toLowerCase();
    if (['button', 'link', 'tab', 'menuitem', 'option'].includes(role)) return true;
    return false;
  }

  function getClickableTarget(el) {
    let current = el;
    let depth = 0;
    while (current && depth < 4) {
      if (isVisible(current) && isInteractive(current)) return current;
      current = current.parentElement;
      depth++;
    }
    return el;
  }

  function getSelectorHint(el) {
    if (!el) return '';
    const text = normalizeText(el.innerText || el.textContent || '');
    if (text && text.length <= 40) return `text=${text}`;
    if (el.id) return `#${el.id}`;
    if (el.getAttribute?.('aria-label')) return `text=${normalizeText(el.getAttribute('aria-label'))}`;
    if (el.getAttribute?.('title')) return `text=${normalizeText(el.getAttribute('title'))}`;
    return buildPath(el);
  }

  function getSafeIdSelector(el) {
    if (!el?.id) return null;
    return `[id="${String(el.id).replace(/"/g, '\\"')}"]`;
  }

  function getPreferredClickSelector(el) {
    const safeIdSelector = getSafeIdSelector(el);
    if (safeIdSelector) return safeIdSelector;
    const text = normalizeText(el?.innerText || el?.textContent || '');
    if (text && text.length <= 40) return `text=${text}`;
    return getSelectorHint(el);
  }

  function getPreferredTypeSelector(el) {
    const safeIdSelector = getSafeIdSelector(el);
    if (safeIdSelector) return safeIdSelector;
    const attrs = [
      el?.getAttribute?.('placeholder'),
      el?.getAttribute?.('aria-label'),
      el?.getAttribute?.('name'),
      el?.getAttribute?.('title')
    ].map(normalizeText).filter(Boolean);
    if (attrs[0] && attrs[0].length <= 40) return `text=${attrs[0]}`;
    const text = normalizeText(el?.innerText || el?.textContent || '');
    if (text && text.length <= 40) return `text=${text}`;
    return getSelectorHint(el);
  }

  function getPreferredReason(el) {
    if (!el) return 'unknown';
    if (el.id) return 'safe-id-selector';
    const text = normalizeText(el.innerText || el.textContent || '');
    if (text && text.length <= 40) return 'short-visible-text';
    return 'selector-hint-fallback';
  }

  function getTagBonus(el) {
    if (!el || !el.tagName) return 0;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 18;
    if (tag === 'button') return 18;
    if (tag === 'input' || tag === 'textarea') return 14;
    if (tag === 'label') return 10;
    if (tag === 'li') return 4;
    return 0;
  }

  function getAttributeBonus(el) {
    if (!el) return 0;
    let bonus = 0;
    if (el.id) bonus += 6;
    const role = (el.getAttribute?.('role') || '').toLowerCase();
    if (['tab', 'button', 'link', 'menuitem', 'option'].includes(role)) bonus += 10;
    const parentRole = (el.parentElement?.getAttribute?.('role') || '').toLowerCase();
    if (['tablist', 'navigation', 'menu'].includes(parentRole)) bonus += 6;
    const parentTag = el.parentElement?.tagName?.toLowerCase();
    if (['nav', 'menu'].includes(parentTag)) bonus += 6;
    return bonus;
  }

  function pushCandidate(candidates, el, score, matchReason, recoveredFrom = null) {
    const clickable = getClickableTarget(el);
    const clickableBonus = clickable !== el ? 8 : 0;
    const interactiveBonus = isInteractive(clickable) ? 15 : 0;
    const tagBonus = getTagBonus(clickable);
    const attributeBonus = getAttributeBonus(clickable);
    const text = normalizeText(clickable.innerText || clickable.textContent || '').slice(0, 120);
    const ownText = getOwnText(clickable).slice(0, 120);
    const selectorHint = getSelectorHint(clickable);
    const safeIdSelector = getSafeIdSelector(clickable);
    const preferredClickSelector = getPreferredClickSelector(clickable);
    const preferredTypeSelector = getPreferredTypeSelector(clickable);
    const preferredReason = getPreferredReason(clickable);
    candidates.push({
      score: score + clickableBonus + interactiveBonus + tagBonus + attributeBonus,
      text,
      ownText,
      tagName: clickable.tagName,
      id: clickable.id || '',
      className: clickable.className || '',
      path: buildPath(clickable),
      selectorHint,
      safeIdSelector,
      preferredClickSelector,
      preferredTypeSelector,
      preferredReason,
      matchReason,
      recoveredFrom
    });
  }

  function dedupeCandidates(items) {
    const map = new Map();
    for (const item of items) {
      const key = `${item.tagName}|${item.id}|${item.path}|${item.selectorHint}`;
      const existing = map.get(key);
      if (!existing || item.score > existing.score) {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }

  function looksLikeCssSelector(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/^text\s*=\s*/i.test(text)) return false;
    if (/^[#.\[]/.test(text)) return true;
    if (/[>~:+*,\s]/.test(text)) return true;
    if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(text)) return true;
    return false;
  }

  const all = collectAllElements(document.documentElement, []);
  let candidates = [];
  let mode = 'css';
  const rawQuery = String(sel || '').trim();
  const explicitTextMatch = rawQuery.match(/^text\s*=\s*(.+)$/i);
  const implicitTextQuery = rawQuery && !looksLikeCssSelector(rawQuery) ? rawQuery : null;
  const textMatch = explicitTextMatch || (implicitTextQuery ? [rawQuery, implicitTextQuery] : null);
  let targetText = null;
  let compactTarget = null;

  if (textMatch) {
    mode = 'text';
    targetText = textMatch[1].trim();
    if ((targetText.startsWith('"') && targetText.endsWith('"')) || (targetText.startsWith("'") && targetText.endsWith("'"))) {
      targetText = targetText.slice(1, -1);
    }
    targetText = normalizeText(targetText);
    compactTarget = targetText.toLowerCase();

    for (const el of all) {
      if (!isVisible(el)) continue;
      const fullText = normalizeText(el.innerText || el.textContent || '');
      const ownText = getOwnText(el);
      const attrs = [
        el.getAttribute?.('aria-label'),
        el.getAttribute?.('title'),
        el.getAttribute?.('value'),
        el.getAttribute?.('data-title'),
        el.getAttribute?.('data-name'),
        el.getAttribute?.('placeholder'),
        el.getAttribute?.('name'),
        el.id,
        typeof el.className === 'string' ? el.className : ''
      ].map(normalizeText).filter(Boolean);
      const haystacks = [fullText, ownText, ...attrs].map(v => v.toLowerCase());
      let score = 0;
      let matchReason = '';

      if (haystacks.some(v => v === compactTarget)) {
        score = 100;
        matchReason = 'exact';
      } else if (haystacks.some(v => v.includes(compactTarget))) {
        score = 82;
        matchReason = 'contains';
      } else if (compactTarget.length >= 2 && haystacks.some(v => compactTarget.includes(v) && v.length >= 2)) {
        score = 70;
        matchReason = 'target-contains-node';
      } else {
        const targetParts = compactTarget.split(/[\s\-_]+/).filter(Boolean);
        const matchedParts = targetParts.filter(part => part.length >= 1 && haystacks.some(v => v.includes(part)));
        if (matchedParts.length >= 1) {
          score = 55 + Math.min(20, matchedParts.length * 8);
          matchReason = `partial:${matchedParts.join(',')}`;
        }
      }

      if (score > 0) pushCandidate(candidates, el, score, matchReason);
    }

    if (candidates.length === 0) {
      for (const el of all) {
        if (!isVisible(el)) continue;
        const text = normalizeText(el.innerText || el.textContent || '');
        const attrs = [
          el.getAttribute?.('aria-label'),
          el.getAttribute?.('title'),
          el.getAttribute?.('value'),
          el.getAttribute?.('data-title'),
          el.getAttribute?.('data-name'),
          el.id,
          typeof el.className === 'string' ? el.className : ''
        ].map(normalizeText).filter(Boolean);

        if (text === targetText) pushCandidate(candidates, el, 110, 'fallback-text-exact');
        else if (attrs.includes(targetText)) pushCandidate(candidates, el, 105, 'fallback-attr-exact');
        else if (text.includes(targetText)) pushCandidate(candidates, el, 90, 'fallback-text-contains');
        else if (attrs.some(v => v && v.includes(targetText))) pushCandidate(candidates, el, 85, 'fallback-attr-contains');
      }
    }
  } else {
    try {
      const found = Array.from(document.querySelectorAll(sel));
      for (const el of found) {
        if (!isVisible(el)) continue;
        pushCandidate(candidates, el, 100, 'css-match');
      }
    } catch {}

    if (candidates.length === 0 && rawQuery.startsWith('#') && rawQuery.length > 1) {
      const rawId = rawQuery.slice(1);
      const byId = document.getElementById(rawId);
      if (byId && isVisible(byId)) {
        mode = 'css-id-fallback';
        pushCandidate(candidates, byId, 100, 'id-fallback', 'invalid-id-selector');
      }
    }
  }

  candidates = dedupeCandidates(candidates)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return {
    success: true,
    data: {
      mode,
      count: candidates.length,
      bestCandidate: candidates[0] || null,
      preferredClickSelector: candidates[0]?.preferredClickSelector || null,
      preferredTypeSelector: candidates[0]?.preferredTypeSelector || null,
      candidates,
      debug: {
        query: sel,
        normalizedQuery: textMatch ? targetText : null,
        interpretedAsText: Boolean(textMatch),
        totalElementsScanned: all.length
      }
    }
  };
}

export function locateWaitMatchInPage(sel, options = {}) {
  const located = locateDomCandidatesInPage(sel);
  const maxCandidates = Number.isFinite(Number(options.maxCandidates)) && Number(options.maxCandidates) > 0
    ? Math.min(Number(options.maxCandidates), 10)
    : 10;
  const candidates = Array.isArray(located?.data?.candidates)
    ? located.data.candidates.slice(0, maxCandidates)
    : [];
  const bestCandidate = candidates[0] || null;

  return {
    success: true,
    data: {
      found: candidates.length > 0,
      count: candidates.length,
      bestCandidate,
      candidates,
      debug: located?.data?.debug || null
    },
    message: candidates.length ? `找到 ${candidates.length} 个候选元素` : '未找到候选元素'
  };
}
