// Tool: summarize_text
// 将提取到的页面文本交给模型进行总结
import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';

export async function summarizeText(text, userIntent = '请总结以下内容') {
  try {
    const config = await chrome.storage.local.get(['apiKey', 'baseUrl', 'model']);
    if (!config.apiKey || !config.baseUrl) {
      return createToolErrorResult({ tool: 'summarize_text', error: { code: 'MISSING_API_CONFIG', message: '未配置 API' } });
    }

    const truncatedText = (text || '').slice(0, 12000);

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '你是一个网页内容总结助手。请根据用户意图，对给定网页内容做清晰、简洁、准确的总结。输出纯文本。'
          },
          {
            role: 'user',
            content: `用户意图：${userIntent}\n\n网页内容：\n${truncatedText}`
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return createToolErrorResult({ tool: 'summarize_text', error: { code: 'API_REQUEST_FAILED', message: `总结请求失败：${response.status} ${err}` } });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      return createToolErrorResult({ tool: 'summarize_text', error: { code: 'EMPTY_MODEL_RESPONSE', message: '模型未返回总结内容' } });
    }

    return createToolSuccessResult({
      tool: 'summarize_text',
      message: summary,
      data: {
        summary
      },
      meta: {
        model: config.model || 'gpt-4o',
        truncatedLength: truncatedText.length
      }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'summarize_text', error: { code: 'TOOL_ERROR', message: error.message } });
  }
}
