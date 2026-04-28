// Agent Core - 标准 tool loop
import { openUrl } from './tools/open_url.js';
import { clickElement } from './tools/click_element.js';
import { typeText } from './tools/type_text.js';
import { extractText } from './tools/extract_text.js';
import { getTabList } from './tools/get_tab_list.js';
import { summarizeText } from './tools/summarize_text.js';
import { findElement } from './tools/find_element.js';
import { waitForElement } from './tools/wait_for_element.js';
import { waitForNavigation } from './tools/wait_for_navigation.js';
import { pressKey } from './tools/press_key.js';
import { scrollIntoView } from './tools/scroll_into_view.js';
import { screenshot } from './tools/screenshot.js';
import { hoverElement } from './tools/hover_element.js';
import { selectOption } from './tools/select_option.js';
import { checkElement } from './tools/check_element.js';
import { waitForText } from './tools/wait_for_text.js';
import { readAttribute } from './tools/read_attribute.js';
import { extractLinks } from './tools/extract_links.js';
import { readStorage } from './tools/read_storage.js';
import { waitForUrlChange } from './tools/wait_for_url_change.js';
import { domSnapshot } from './tools/dom_snapshot.js';
import { extractForms } from './tools/extract_forms.js';
import { readCookie } from './tools/read_cookie.js';
import { waitForNetworkIdle } from './tools/wait_for_network_idle.js';
import { extractImages } from './tools/extract_images.js';
import { uploadFile } from './tools/upload_file.js';
import { fillForm } from './tools/fill_form.js';

const TOOL_EXECUTORS = {
  open_url: openUrl,
  click_element: clickElement,
  type_text: typeText,
  extract_text: extractText,
  get_tab_list: getTabList,
  summarize_text: summarizeText,
  find_element: findElement,
  wait_for_element: waitForElement,
  wait_for_navigation: waitForNavigation,
  press_key: pressKey,
  scroll_into_view: scrollIntoView,
  screenshot: screenshot,
  hover_element: hoverElement,
  select_option: selectOption,
  check_element: checkElement,
  wait_for_text: waitForText,
  read_attribute: readAttribute,
  extract_links: extractLinks,
  read_storage: readStorage,
  wait_for_url_change: waitForUrlChange,
  dom_snapshot: domSnapshot,
  extract_forms: extractForms,
  read_cookie: readCookie,
  wait_for_network_idle: waitForNetworkIdle,
  extract_images: extractImages,
  upload_file: uploadFile,
  fill_form: fillForm
};

const API_RETRY_INTERVAL_MS = 5000;
const API_MAX_RETRIES = 10;

const TOOL_ARG_ORDER = {
  open_url: ['url', 'newTab'],
  click_element: ['selector'],
  type_text: ['selector', 'text'],
  extract_text: [],
  get_tab_list: [],
  summarize_text: ['text', 'userIntent'],
  find_element: ['selectorOrText'],
  wait_for_element: ['selectorOrText', 'timeoutMs', 'intervalMs'],
  wait_for_navigation: ['timeoutMs', 'intervalMs'],
  press_key: ['key', 'selector', 'observeMs'],
  scroll_into_view: ['selector', 'behavior', 'block', 'inline', 'observeMs'],
  screenshot: ['format', 'quality', 'fullPage'],
  hover_element: ['selector', 'observeMs'],
  select_option: ['selector', 'value', 'label', 'index', 'observeMs'],
  check_element: ['selector', 'checked', 'observeMs'],
  wait_for_text: ['text', 'caseSensitive', 'timeoutMs', 'intervalMs', 'maxMatches'],
  read_attribute: ['selector', 'attribute', 'observeMs'],
  extract_links: ['includeExternal', 'maxLinks'],
  read_storage: ['type', 'key', 'observeMs'],
  wait_for_url_change: ['timeoutMs', 'intervalMs'],
  dom_snapshot: ['maxDepth', 'maxNodes'],
  extract_forms: ['includeHidden', 'maxForms', 'maxFieldsPerForm'],
  read_cookie: ['name', 'domain', 'observeMs'],
  wait_for_network_idle: ['timeoutMs', 'quietMs'],
  extract_images: ['maxImages', 'includeBackgroundImages'],
  upload_file: ['selector', 'filePath', 'observeMs'],
  fill_form: ['fields', 'maxFields']
};

const TOOLS = {
  open_url: { description: '打开网址。可新开标签页或在当前标签页跳转。执行后会自动监听页面异常与变化', parameters: { url: 'string', newTab: 'boolean' } },
  click_element: { description: '点击元素。selector 支持 CSS 选择器，或 text=元素文字 这种文本定位格式。执行后会自动监听页面异常与变化', parameters: { selector: 'string' } },
  type_text: { description: '输入文字。selector 支持 CSS 选择器，或 text=元素文字。执行后会自动监听页面异常与变化', parameters: { selector: 'string', text: 'string' } },
  extract_text: { description: '提取当前页面主要内容文本', parameters: {} },
  get_tab_list: { description: '获取标签列表', parameters: {} },
  summarize_text: { description: '总结给定文本内容', parameters: { text: 'string', userIntent: 'string' } },
  find_element: { description: '查找页面元素，返回候选元素列表。优先用于点击/输入前定位元素', parameters: { selectorOrText: 'string' } },
  wait_for_element: {
    description: '等待页面元素出现。selectorOrText 支持 CSS 选择器或 text=文字，适合点击或输入前先确认元素已出现',
    parameters: { selectorOrText: 'string', timeoutMs: 'number', intervalMs: 'number' }
  },
  wait_for_navigation: {
    description: '等待页面跳转或状态切换，基于 URL 或 title 变化判断是否发生导航',
    parameters: { timeoutMs: 'number', intervalMs: 'number' }
  },
  press_key: {
    description: '触发键盘按键，适合输入后按 Enter、关闭弹层按 Escape、或用 Tab/方向键移动焦点',
    parameters: { key: 'string', selector: 'string', observeMs: 'number' }
  },
  scroll_into_view: {
    description: '将目标元素滚动到可视区域内，适合点击或输入前先把元素滚到视口中心附近',
    parameters: { selector: 'string', behavior: 'string', block: 'string', inline: 'string', observeMs: 'number' }
  },
  screenshot: {
    description: '截取当前页面可视区域截图，用于调试、失败回看或视觉确认',
    parameters: { format: 'string', quality: 'number', fullPage: 'boolean' }
  },
  hover_element: {
    description: '悬停元素，适合展开菜单、显示提示或触发 hover 状态',
    parameters: { selector: 'string', observeMs: 'number' }
  },
  select_option: {
    description: '选择下拉框选项，适合原生 select 控件',
    parameters: { selector: 'string', value: 'string', label: 'string', index: 'number', observeMs: 'number' }
  },
  check_element: {
    description: '勾选或取消勾选复选框，适合原生 checkbox',
    parameters: { selector: 'string', checked: 'boolean', observeMs: 'number' }
  },
  wait_for_text: {
    description: '等待页面中出现指定文本，适合内容加载或状态提示确认',
    parameters: { text: 'string', caseSensitive: 'boolean', timeoutMs: 'number', intervalMs: 'number', maxMatches: 'number' }
  },
  read_attribute: {
    description: '读取元素属性值，适合查看 data-*、aria-*、href、title 等字段',
    parameters: { selector: 'string', attribute: 'string', observeMs: 'number' }
  },
  extract_links: {
    description: '提取当前页面所有可见链接，适合做导航收集、站内链接分析或批量检查',
    parameters: { includeExternal: 'boolean', maxLinks: 'number' }
  },
  read_storage: {
    description: '读取页面 localStorage 或 sessionStorage 中的值，适合查看登录态、草稿和开关状态',
    parameters: { type: 'string', key: 'string', observeMs: 'number' }
  },
  wait_for_url_change: {
    description: '等待当前标签页 URL 发生变化，适合点击跳转、提交表单后的导航确认',
    parameters: { timeoutMs: 'number', intervalMs: 'number' }
  },
  dom_snapshot: {
    description: '生成页面 DOM 结构快照，适合调试复杂页面、辅助定位和恢复判断',
    parameters: { maxDepth: 'number', maxNodes: 'number' }
  },
  extract_forms: {
    description: '提取页面表单结构和字段信息，适合自动填写前分析、表单调试和批量检查',
    parameters: { includeHidden: 'boolean', maxForms: 'number', maxFieldsPerForm: 'number' }
  },
  read_cookie: {
    description: '读取当前站点 cookie 的值，适合判断登录态和会话状态',
    parameters: { name: 'string', domain: 'string', observeMs: 'number' }
  },
  wait_for_network_idle: {
    description: '等待网络请求进入空闲状态，适合提交表单后确认页面加载完毕',
    parameters: { timeoutMs: 'number', quietMs: 'number' }
  },
  extract_images: {
    description: '提取页面中的可见图片和背景图，适合资源检查和图片批量分析',
    parameters: { maxImages: 'number', includeBackgroundImages: 'boolean' }
  },
  upload_file: {
    description: '向文件输入框上传文件，适合附件、图片或文档上传',
    parameters: { selector: 'string', filePath: 'string', observeMs: 'number' }
  },
  fill_form: {
    description: '按字段列表填写表单，适合批量填充输入框',
    parameters: { fields: 'array', maxFields: 'number' }
  }
};

const OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'open_url',
      description: TOOLS.open_url.description,
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          newTab: { type: 'boolean' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'click_element',
      description: TOOLS.click_element.description,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS 选择器，或 text=元素文字，例如 text=研究' }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: TOOLS.type_text.description,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS 选择器，或 text=元素文字，例如 text=搜索' },
          text: { type: 'string' }
        },
        required: ['selector', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_text',
      description: TOOLS.extract_text.description,
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_tab_list',
      description: TOOLS.get_tab_list.description,
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'summarize_text',
      description: TOOLS.summarize_text.description,
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          userIntent: { type: 'string' }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'find_element',
      description: TOOLS.find_element.description,
      parameters: {
        type: 'object',
        properties: {
          selectorOrText: { type: 'string', description: 'CSS 选择器或 text=文字' }
        },
        required: ['selectorOrText']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'wait_for_element',
      description: TOOLS.wait_for_element.description,
      parameters: {
        type: 'object',
        properties: {
          selectorOrText: { type: 'string', description: 'CSS 选择器或 text=文字' },
          timeoutMs: { type: 'number' },
          intervalMs: { type: 'number' }
        },
        required: ['selectorOrText']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'wait_for_navigation',
      description: TOOLS.wait_for_navigation.description,
      parameters: {
        type: 'object',
        properties: {
          timeoutMs: { type: 'number' },
          intervalMs: { type: 'number' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'press_key',
      description: TOOLS.press_key.description,
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          selector: { type: 'string', description: '可选，指定目标元素；支持 CSS 或 text=文字' },
          observeMs: { type: 'number' }
        },
        required: ['key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'scroll_into_view',
      description: TOOLS.scroll_into_view.description,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS 选择器或 text=文字' },
          behavior: { type: 'string' },
          block: { type: 'string' },
          inline: { type: 'string' },
          observeMs: { type: 'number' }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'screenshot',
      description: TOOLS.screenshot.description,
      parameters: {
        type: 'object',
        properties: {
          format: { type: 'string' },
          quality: { type: 'number' },
          fullPage: { type: 'boolean' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'hover_element',
      description: TOOLS.hover_element.description,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          observeMs: { type: 'number' }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'select_option',
      description: TOOLS.select_option.description,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          value: { type: 'string' },
          label: { type: 'string' },
          index: { type: 'number' },
          observeMs: { type: 'number' }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_element',
      description: TOOLS.check_element.description,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          checked: { type: 'boolean' },
          observeMs: { type: 'number' }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'wait_for_text',
      description: TOOLS.wait_for_text.description,
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          caseSensitive: { type: 'boolean' },
          timeoutMs: { type: 'number' },
          intervalMs: { type: 'number' },
          maxMatches: { type: 'number' }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_attribute',
      description: TOOLS.read_attribute.description,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          attribute: { type: 'string' },
          observeMs: { type: 'number' }
        },
        required: ['selector', 'attribute']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_links',
      description: TOOLS.extract_links.description,
      parameters: {
        type: 'object',
        properties: {
          includeExternal: { type: 'boolean' },
          maxLinks: { type: 'number' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_storage',
      description: TOOLS.read_storage.description,
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          key: { type: 'string' },
          observeMs: { type: 'number' }
        },
        required: ['key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'wait_for_url_change',
      description: TOOLS.wait_for_url_change.description,
      parameters: {
        type: 'object',
        properties: {
          timeoutMs: { type: 'number' },
          intervalMs: { type: 'number' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'dom_snapshot',
      description: TOOLS.dom_snapshot.description,
      parameters: {
        type: 'object',
        properties: {
          maxDepth: { type: 'number' },
          maxNodes: { type: 'number' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_forms',
      description: TOOLS.extract_forms.description,
      parameters: {
        type: 'object',
        properties: {
          includeHidden: { type: 'boolean' },
          maxForms: { type: 'number' },
          maxFieldsPerForm: { type: 'number' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_cookie',
      description: TOOLS.read_cookie.description,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          domain: { type: 'string' },
          observeMs: { type: 'number' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'wait_for_network_idle',
      description: TOOLS.wait_for_network_idle.description,
      parameters: {
        type: 'object',
        properties: {
          timeoutMs: { type: 'number' },
          quietMs: { type: 'number' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_images',
      description: TOOLS.extract_images.description,
      parameters: {
        type: 'object',
        properties: {
          maxImages: { type: 'number' },
          includeBackgroundImages: { type: 'boolean' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'upload_file',
      description: TOOLS.upload_file.description,
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          filePath: { type: 'string' },
          observeMs: { type: 'number' }
        },
        required: ['selector', 'filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fill_form',
      description: TOOLS.fill_form.description,
      parameters: {
        type: 'object',
        properties: {
          fields: { type: 'array' },
          maxFields: { type: 'number' }
        },
        required: ['fields']
      }
    }
  }
];

const TOOL_LOOP_PROMPT = `# 角色
你是浏览器代理，采用标准 tool loop 工作：
- 先理解用户目标
- 决定下一步是否调用工具
- 看工具返回结果
- 再决定下一步
- 直到任务完成，再给最终答案

# 可用工具
${JSON.stringify(TOOLS, null, 2)}

# 关键策略
- 你一次只需要决定“下一步”最合理的动作
- 对网页交互任务，优先先观察/定位，再执行操作
- 如果页面可能尚未加载完成，点击或输入前优先先用 wait_for_element
- 点击跳转、搜索提交或可能触发页面切换的动作后，优先用 wait_for_navigation 确认是否真的发生变化
- 当输入后需要真正触发搜索/提交时，优先用 press_key(Enter)
- 如果元素可能在视口外、被遮挡或不好点，先用 scroll_into_view 再点击/输入
- 当任务失败、页面异常或需要回看视觉状态时，用 screenshot 保留当前页面快照
- 当需要展开菜单或触发 hover 状态时，用 hover_element
- 当用户操作原生下拉框时，用 select_option
- 当用户操作原生复选框时，用 check_element
- 当用户要等某句话/某个状态文案出现时，用 wait_for_text
- 当需要读取 href / title / data-* / aria-* 之类属性时，用 read_attribute
- 当要收集当前页链接列表、做导航分析或批量检查时，用 extract_links
- 当需要查看 localStorage / sessionStorage 值时，用 read_storage
- 当点击后要精确等 URL 变化时，用 wait_for_url_change
- 当需要调试复杂页面结构或给恢复策略提供页面摘要时，用 dom_snapshot
- 当需要分析页面表单结构、字段或下拉选项时，用 extract_forms
- 当需要查看站点 cookie / 登录会话状态时，用 read_cookie
- 当需要等待网络请求都落稳时，用 wait_for_network_idle
- 当需要扫页面图片资源时，用 extract_images
- 当需要往文件输入框上传文件时，用 upload_file
- 当需要按字段批量填表单时，用 fill_form
- 当用户说“点击某个栏目/按钮/链接/文字”时，优先先用 find_element；若元素可能尚未出现，先用 wait_for_element
- 当用户说“在某个输入框输入内容”时，优先先用 find_element，再用 type_text；若输入框可能尚未出现，先用 wait_for_element
- 如果是点击页面可见文字，优先使用 text=文字，例如 text=研究
- 对于短中文关键词（如“研究”“首页”“登录”），即使没写 text=，也应按文本目标理解，不要把它当 CSS selector
- 如果 wait_for_element 或 find_element 返回了 bestCandidate / preferredClickSelector / preferredTypeSelector，后续优先消费这些字段
- 如果 find_element 返回了 bestCandidate / preferredClickSelector，下一步点击优先使用 preferredClickSelector
- 如果没有 preferredClickSelector，再参考 candidates[0] 的 selectorHint / text / id / path
- 不要盲目把 path 当成 CSS selector；优先使用 preferredClickSelector、text=可见文字，或合法的 selectorHint
- 如果某个 selector 执行失败，先根据错误信息修正参数，不要机械重复同一个错误 selector
- 如果是原生 select / checkbox / hover 场景，优先用对应专用工具，不要硬用 click_element 反复试
- 如果是文本状态确认或属性读取，优先用 wait_for_text / read_attribute
- 如果是链接收集或站内导航梳理，优先用 extract_links
- 如果要看登录态、草稿、开关状态等持久化值，优先用 read_storage
- 如果需要确认导航是否真的发生，优先用 wait_for_url_change
- 如果页面特别复杂，先用 dom_snapshot 看结构再决定下一步
- 如果要理解一个表单有哪些字段，优先用 extract_forms
- 如果要判断是否登录或会话是否有效，优先用 read_cookie
- 如果表单提交后页面仍在加载，优先用 wait_for_network_idle
- 如果要批量检查页面图片，优先用 extract_images
- 如果要处理上传控件，优先用 upload_file
- 如果是批量填表，优先用 fill_form
- 当 click_element / type_text / open_url 返回 observation 时，要认真参考：
  - urlChanged / titleChanged
  - errorCount / rejectionCount / resourceErrorCount
  - keywordHits
  - summary
- 如果 observation 显示异常，不要立刻声称成功；先根据工具结果继续判断，必要时继续找元素、重试、换策略
- 如果用户要求“提取当前页面内容并总结 / 帮我分析这个页面”，通常应先 extract_text，再 summarize_text
- summarize_text 的 text 参数应来自 extract_text 的 data.text

# 强约束
- 如果用户意图是点击/打开某个页面区域/栏目/导航/按钮，而 find_element 没找到，不要立刻改做 extract_text
- 点击任务里，只有用户明确要求“分析页面/提取内容/总结页面”时，才使用 extract_text
- 如果点击任务第一次 find_element 失败，优先再试一次更宽松的 text=关键词，或直接 click_element(text=关键词)
- 输入任务第一次 find_element 失败，优先再试更宽松关键词，不要改成不相关工具

# 输出规则
- 优先使用原生 tool calling
- 如果模型不支持原生 tool calling，也必须只返回 JSON，且格式二选一：
1. 调用工具：{"tool":"工具名","args":[参数]}
2. 最终回答：{"final":"给用户的最终回答"}
- 不要输出 markdown，不要输出解释性前后缀
- 如果工具失败，不要停住；先根据失败信息决定是否改用别的工具或换参数
- 只有你确信任务完成，才返回 final`;

function createSyntheticToolCall(name, args, index = 0) {
  return {
    id: `synthetic_${Date.now()}_${index}`,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(args || {})
    }
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getArgOrder(toolName) {
  return TOOL_ARG_ORDER[toolName] || [];
}

function argsObjectToArray(toolName, argsObject) {
  const order = getArgOrder(toolName);
  if (!argsObject || typeof argsObject !== 'object' || Array.isArray(argsObject)) return [];
  const ordered = [];
  for (const key of order) {
    if (key in argsObject) ordered.push(argsObject[key]);
  }
  for (const [key, value] of Object.entries(argsObject)) {
    if (!order.includes(key)) ordered.push(value);
  }
  return ordered;
}

function argsArrayToObject(toolName, argsArray) {
  const order = getArgOrder(toolName);
  const argsObject = {};
  (argsArray || []).forEach((value, index) => {
    argsObject[order[index] || `arg${index}`] = value;
  });
  return argsObject;
}

function normalizeArgsInput(toolName, parsed) {
  if (Array.isArray(parsed?.args)) {
    return {
      argsArray: parsed.args,
      argsObject: argsArrayToObject(toolName, parsed.args)
    };
  }

  if (parsed?.args && typeof parsed.args === 'object') {
    return {
      argsObject: parsed.args,
      argsArray: argsObjectToArray(toolName, parsed.args)
    };
  }

  const argsObject = {};
  const order = getArgOrder(toolName);
  for (const key of order) {
    if (parsed && key in parsed) argsObject[key] = parsed[key];
  }
  return {
    argsObject,
    argsArray: argsObjectToArray(toolName, argsObject)
  };
}

function isLikelyInvalidSelector(selector) {
  if (typeof selector !== 'string') return false;
  const trimmed = selector.trim();
  if (!trimmed) return false;
  if (/^text\s*=/.test(trimmed)) return false;
  if (/\s>\s/.test(trimmed)) return true;
  if (/^#\d/.test(trimmed)) return true;
  return false;
}

function inferIntent(command) {
  const text = String(command || '');
  return {
    isClick: /(点击|点开|点一下|打开.*栏目|进入.*栏目|打开.*标签|打开.*导航|选择.*栏目|去.*栏目)/.test(text),
    isType: /(输入|填写|搜索|查找|在.*框.*输入)/.test(text),
    isExtract: /(提取|总结|分析这个页面|分析当前页面|读取页面|总结页面|提炼页面)/.test(text)
  };
}

function looksLikeBareTextQuery(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^text\s*=\s*/i.test(text)) return false;
  if (/^[#.\[]/.test(text)) return false;
  if (/[>~:+*=]/.test(text)) return false;
  if (/\s{2,}/.test(text)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(text)) return false;
  return true;
}

function normalizeToolCallForIntent(toolCall) {
  if (!toolCall) return toolCall;
  const name = toolCall.name;
  const argsArray = [...(toolCall.argsArray || [])];

  if ((name === 'find_element' || name === 'click_element') && typeof argsArray[0] === 'string' && looksLikeBareTextQuery(argsArray[0])) {
    argsArray[0] = `text=${argsArray[0].trim()}`;
    return {
      ...toolCall,
      argsArray,
      argsObject: argsArrayToObject(name, argsArray),
      normalizedByAgent: 'bare-text-to-text-selector'
    };
  }

  return toolCall;
}

function extractIntentKeyword(command) {
  const text = String(command || '').trim();
  const patterns = [
    /点击(.+?)(?:一栏|栏目|按钮|链接|标签|导航|页签|选项|$)/,
    /点开(.+?)(?:一栏|栏目|按钮|链接|标签|导航|页签|选项|$)/,
    /进入(.+?)(?:一栏|栏目|按钮|链接|标签|导航|页签|选项|$)/,
    /打开(.+?)(?:一栏|栏目|按钮|链接|标签|导航|页签|选项|$)/,
    /在(.+?)(?:框|输入框|搜索框).*(?:输入|填写|搜索)/,
    /(?:输入|填写|搜索)(.+?)(?:框|输入框|搜索框|$)/
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) {
      return match[1].replace(/[“”"'：:，,。.!！?？]/g, '').trim();
    }
  }

  return text.replace(/[“”"'：:，,。.!！?？]/g, '').trim().slice(0, 20);
}

function buildIntentGuardToolCall(command, history = []) {
  const intent = inferIntent(command);
  const keyword = extractIntentKeyword(command);
  const recentFind = [...history].reverse().find(item => item.originalTool === 'find_element' || item.tool === 'find_element');
  const recentCandidates = recentFind?.result?.data?.candidates || [];
  const bestCandidate = recentFind?.result?.data?.bestCandidate || recentCandidates[0] || null;
  const recentFindCount = recentFind?.result?.data?.count || 0;
  const recentFindArg = recentFind?.args?.[0] || recentFind?.originalArgs?.[0] || null;

  if (intent.isClick && !intent.isExtract) {
    if (bestCandidate) {
      if (bestCandidate?.preferredClickSelector) {
        return { name: 'click_element', argsArray: [bestCandidate.preferredClickSelector], guardReason: `click-intent-use-best-candidate:${bestCandidate.preferredReason || 'preferred'}` };
      }
      if (bestCandidate?.selectorHint?.startsWith('text=')) {
        return { name: 'click_element', argsArray: [bestCandidate.selectorHint], guardReason: 'click-intent-use-top-candidate-selectorHint' };
      }
      if (bestCandidate?.text) {
        return { name: 'click_element', argsArray: [`text=${bestCandidate.text}`], guardReason: 'click-intent-use-top-candidate-text' };
      }
    }

    if (recentFind && recentFindCount === 0) {
      if (keyword && recentFindArg !== `text=${keyword}`) {
        return { name: 'find_element', argsArray: [`text=${keyword}`], guardReason: 'click-intent-retry-find-by-keyword' };
      }
      return { name: 'final_answer', argsArray: [`未找到“${keyword || '目标'}”对应元素，已停止点击，避免误操作。`], guardReason: 'click-intent-stop-when-find-empty' };
    }

    if (keyword) {
      return { name: 'find_element', argsArray: [`text=${keyword}`], guardReason: 'click-intent-find-before-click' };
    }
  }

  if (intent.isType) {
    if (bestCandidate) {
      if (bestCandidate?.preferredTypeSelector) {
        return { name: 'type_text', argsArray: [bestCandidate.preferredTypeSelector, extractTypedValue(command)], guardReason: `type-intent-use-best-candidate:${bestCandidate.preferredReason || 'preferred'}` };
      }
      if (bestCandidate?.preferredClickSelector) {
        return { name: 'type_text', argsArray: [bestCandidate.preferredClickSelector, extractTypedValue(command)], guardReason: `type-intent-use-best-candidate-click-selector:${bestCandidate.preferredReason || 'preferred'}` };
      }
      if (bestCandidate?.selectorHint?.startsWith('text=')) {
        return { name: 'type_text', argsArray: [bestCandidate.selectorHint, extractTypedValue(command)], guardReason: 'type-intent-use-top-candidate-selectorHint' };
      }
      if (bestCandidate?.text) {
        return { name: 'type_text', argsArray: [`text=${bestCandidate.text}`, extractTypedValue(command)], guardReason: 'type-intent-use-top-candidate-text' };
      }
    }
    if (recentFind && recentFindCount === 0) {
      if (keyword && recentFindArg !== `text=${keyword}`) {
        return { name: 'find_element', argsArray: [`text=${keyword}`], guardReason: 'type-intent-retry-find-by-keyword' };
      }
      return { name: 'final_answer', argsArray: [`未找到可输入的目标元素，已停止后续输入。`], guardReason: 'type-intent-stop-when-find-empty' };
    }
    if (keyword) {
      return { name: 'find_element', argsArray: [`text=${keyword}`], guardReason: 'type-intent-find-before-type' };
    }
  }

  return null;
}

function extractTypedValue(command) {
  const text = String(command || '').trim();
  const patterns = [
    /输入\s*[“"']?(.+?)[”"']?$/,
    /填写\s*[“"']?(.+?)[”"']?$/,
    /搜索\s*[“"']?(.+?)[”"']?$/,
    /输入.*?[为是]\s*[“"']?(.+?)[”"']?$/,
    /填写.*?[为是]\s*[“"']?(.+?)[”"']?$/
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function buildFallbackFinalText(executedSteps = []) {
  const lastMeaningfulStep = [...executedSteps].reverse().find(step => step?.tool && step.tool !== 'scroll_into_view');
  if (!lastMeaningfulStep) {
    return '任务已执行完成。';
  }

  const message = String(lastMeaningfulStep.result?.message || '').trim();
  return message
    ? `任务已执行完成。最后一步：${lastMeaningfulStep.tool}（${message}）`
    : `任务已执行完成。最后一步：${lastMeaningfulStep.tool}`;
}

function buildPreflightToolCall(toolCall, history = []) {
  if (!toolCall || toolCall.name !== 'click_element') return null;

  const selector = toolCall.argsArray?.[0];
  if (typeof selector !== 'string' || !selector.trim()) return null;

  const alreadyScrolled = [...history].reverse().find(item => item.tool === 'scroll_into_view' && item.args?.[0] === selector);
  if (alreadyScrolled) return null;

  return {
    toolName: 'scroll_into_view',
    argsArray: [selector],
    preflightReason: 'click-preflight-scroll-into-view'
  };
}

function maybeRecoverToolCall(toolName, argsArray, lastResult, history = [], command = '') {
  if (!lastResult || lastResult.success !== false) return null;

  if (toolName === 'click_element') {
    const selector = argsArray?.[0];
    const error = String(lastResult.error || '');

    if (typeof selector === 'string' && selector.startsWith('#') && error.includes('无效选择器')) {
      return {
        toolName: 'click_element',
        argsArray: [`[id="${selector.slice(1).replace(/"/g, '\\"')}"]`],
        recoveryReason: 'invalid-id-selector-to-id-attr'
      };
    }

    if (typeof selector === 'string' && selector.startsWith('[id="') && error.includes('未找到元素')) {
      const recentFind = [...history].reverse().find(item => item.tool === 'find_element' && item.result?.success && item.result?.data?.bestCandidate);
      const best = recentFind?.result?.data?.bestCandidate;
      if (best?.selectorHint?.startsWith('text=')) {
        return {
          toolName: 'click_element',
          argsArray: [best.selectorHint],
          recoveryReason: 'id-attr-click-failed-fallback-to-best-text-selector'
        };
      }
    }

    if (isLikelyInvalidSelector(selector)) {
      const recentFind = [...history].reverse().find(item => item.tool === 'find_element' && item.result?.success && item.result?.data?.candidates?.length);
      const firstCandidate = recentFind?.result?.data?.candidates?.[0];
      if (firstCandidate?.text) {
        return {
          toolName: 'click_element',
          argsArray: [`text=${firstCandidate.text}`],
          recoveryReason: 'replace-invalid-selector-with-candidate-text'
        };
      }
    }

    const hasRecentScreenshot = [...history].reverse().find(item => item.tool === 'screenshot' && item.result?.success);
    if (!hasRecentScreenshot) {
      return {
        toolName: 'screenshot',
        argsArray: [],
        recoveryReason: 'click-failed-capture-screenshot'
      };
    }

    if (typeof selector === 'string' && selector.startsWith('text=')) {
      const keyword = extractIntentKeyword(command);
      if (keyword && keyword !== selector.slice(5)) {
        return {
          toolName: 'find_element',
          argsArray: [`text=${keyword}`],
          recoveryReason: 'text-click-failed-retry-find-by-intent-keyword'
        };
      }
    }
  }

  return null;
}

function shouldBlockToolCall(command, toolName, history = []) {
  const intent = inferIntent(command);
  const recentFind = [...history].reverse().find(item => item.tool === 'find_element' || item.originalTool === 'find_element');
  const recentFindCount = recentFind?.result?.data?.count || 0;

  if ((intent.isClick || intent.isType) && !intent.isExtract) {
    if ((toolName === 'extract_text' || toolName === 'summarize_text') && recentFind && recentFindCount === 0) {
      return true;
    }

    if (toolName === 'click_element' && recentFind && recentFindCount === 0) {
      return true;
    }
  }

  return false;
}

async function parseAIJsonContent(content) {
  const cleaned = String(content || '').replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const codeBlockMatch = cleaned.match(/```json\s*([\s\S]*?)```/i) || cleaned.match(/```\s*([\s\S]*?)```/i);
    if (codeBlockMatch?.[1]) return JSON.parse(codeBlockMatch[1].trim());

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch?.[0]) return JSON.parse(arrayMatch[0]);

    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) return JSON.parse(objectMatch[0]);

    throw new Error(`JSON 解析失败：${cleaned}`);
  }
}

async function getConfig() {
  const config = await chrome.storage.local.get(['apiKey', 'baseUrl', 'model']);
  if (!config.apiKey || !config.baseUrl) throw new Error('未配置 API');
  return config;
}

async function callChatCompletion(messages, config) {
  let lastError;

  for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
    try {
      const isSystemPresent = messages.length > 0 && messages[0].role === 'system';
      const apiMessages = isSystemPresent ? messages : [
        { role: 'system', content: TOOL_LOOP_PROMPT },
        ...messages
      ];
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o',
          messages: apiMessages,
          temperature: 0.1,
          max_tokens: 900,
          tools: OPENAI_TOOLS,
          tool_choice: 'auto'
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API ${response.status}: ${err}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      if (!message) throw new Error('AI 空响应');
      return message;
    } catch (error) {
      lastError = error;

      if (attempt < API_MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, API_RETRY_INTERVAL_MS));
      }
    }
  }

  throw lastError;
}

async function normalizeAssistantTurn(message) {
  if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
    return {
      type: 'tool_calls',
      assistantMessage: {
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.tool_calls
      },
      toolCalls: message.tool_calls.map(call => {
        const parsed = safeJsonParse(call.function?.arguments || '{}') || {};
        return {
          id: call.id,
          name: call.function?.name,
          argsObject: parsed,
          argsArray: argsObjectToArray(call.function?.name, parsed)
        };
      })
    };
  }

  const content = (message?.content || '').trim();
  if (!content) {
    return {
      type: 'final',
      assistantMessage: { role: 'assistant', content: '' },
      final: ''
    };
  }

  let parsed = null;
  try {
    parsed = await parseAIJsonContent(content);
  } catch {
    parsed = null;
  }

  if (parsed?.tool) {
    const normalizedArgs = normalizeArgsInput(parsed.tool, parsed);
    const synthetic = createSyntheticToolCall(parsed.tool, normalizedArgs.argsObject, 0);
    return {
      type: 'tool_calls',
      assistantMessage: { role: 'assistant', content },
      toolCalls: [{ id: synthetic.id, name: parsed.tool, argsObject: normalizedArgs.argsObject, argsArray: normalizedArgs.argsArray }]
    };
  }

  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(item => item?.tool)) {
    const toolCalls = parsed.map((item, index) => {
      const normalizedArgs = normalizeArgsInput(item.tool, item);
      const synthetic = createSyntheticToolCall(item.tool, normalizedArgs.argsObject, index);
      return { id: synthetic.id, name: item.tool, argsObject: normalizedArgs.argsObject, argsArray: normalizedArgs.argsArray };
    });
    return {
      type: 'tool_calls',
      assistantMessage: { role: 'assistant', content },
      toolCalls
    };
  }

  if (parsed?.final) {
    return {
      type: 'final',
      assistantMessage: { role: 'assistant', content },
      final: parsed.final
    };
  }

  if (parsed?.response) {
    return {
      type: 'final',
      assistantMessage: { role: 'assistant', content },
      final: parsed.response
    };
  }

  return {
    type: 'final',
    assistantMessage: { role: 'assistant', content },
    final: content
  };
}

async function isExtensionPageActive() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return Boolean(tab?.url?.startsWith('chrome-extension://') || tab?.url?.startsWith('chrome://'));
  } catch {
    return false;
  }
}

async function executeToolCall(name, argsArray) {
  const toolFn = TOOL_EXECUTORS[name];
  if (!toolFn) {
    return { success: false, error: `未知工具：${name}` };
  }

  if (['click_element', 'type_text', 'extract_text', 'find_element'].includes(name)) {
    if (await isExtensionPageActive()) {
      return { success: false, error: '无法在扩展内部页面 (如设置页) 执行此操作，请先切换到普通网页。' };
    }
  }

  try {
    const result = await toolFn(...(argsArray || []));
    return result || { success: false, error: '工具未返回结果' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function runToolLoop(command, hooks = {}, options = {}) {
  const config = await getConfig();
  const maxTurns = hooks.maxTurns || 100;
  const messages = options.existingMessages && options.existingMessages.length > 0
    ? [...options.existingMessages, { role: 'user', content: command }]
    : [{ role: 'system', content: TOOL_LOOP_PROMPT }, { role: 'user', content: command }];
  const executedSteps = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    hooks.onLog?.(`[ToolLoop] 第 ${turn + 1} 轮思考`, 'info');
    const rawMessage = await callChatCompletion(messages, config);
    const normalized = await normalizeAssistantTurn(rawMessage);
    messages.push(normalized.assistantMessage);

    if (normalized.type === 'final') {
      const finalText = String(normalized.final || '').trim() || buildFallbackFinalText(executedSteps);
      hooks.onLog?.(`[ToolLoop] 模型直接返回 final：${finalText}`, 'info');
      hooks.onFinal?.(finalText, { turn, messages, executedSteps, finalFromModel: true });
      return {
        success: true,
        final: finalText,
        turns: turn + 1,
        steps: executedSteps,
        messages
      };
    }

    for (let i = 0; i < normalized.toolCalls.length; i++) {
      let toolCall = normalizeToolCallForIntent(normalized.toolCalls[i]);

      if (shouldBlockToolCall(command, toolCall.name, executedSteps)) {
        const guardTool = buildIntentGuardToolCall(command, executedSteps);
        if (guardTool) {
          hooks.onLog?.(`[ToolLoop] 意图护栏触发：阻止 ${toolCall.name}，改为 ${guardTool.name}，原因：${guardTool.guardReason}`, 'warning');

          if (guardTool.name === 'final_answer') {
            const finalText = guardTool.argsArray?.[0] || '已停止执行。';
            hooks.onLog?.(`[ToolLoop] 意图护栏改为 final：${finalText}，原始工具：${toolCall.name}，原因：${guardTool.guardReason}`, 'warning');
            hooks.onFinal?.(finalText, { turn, messages, executedSteps, guardedStop: true, guardReason: guardTool.guardReason });
            return {
              success: false,
              final: finalText,
              turns: turn + 1,
              steps: executedSteps,
              messages,
              error: finalText
            };
          }

          toolCall = normalizeToolCallForIntent({
            id: `guard_${Date.now()}_${turn}_${i}`,
            name: guardTool.name,
            argsArray: guardTool.argsArray,
            argsObject: argsArrayToObject(guardTool.name, guardTool.argsArray),
            guardReason: guardTool.guardReason,
            originalBlockedTool: normalized.toolCalls[i].name
          });
        }
      }

      const preflight = buildPreflightToolCall(toolCall, executedSteps);
      if (preflight) {
        hooks.onLog?.(`[ToolLoop] 预处理：${toolCall.name} 前先执行 ${preflight.toolName}，原因：${preflight.preflightReason}`, 'info');
        const preflightResult = await executeToolCall(preflight.toolName, preflight.argsArray);
        executedSteps.push({
          turn: turn + 1,
          tool: preflight.toolName,
          originalTool: preflight.toolName,
          args: preflight.argsArray,
          originalArgs: preflight.argsArray,
          guardReason: null,
          originalBlockedTool: null,
          preflight,
          recovery: null,
          result: preflightResult
        });
        hooks.onAfterTool?.({ ...toolCall, name: preflight.toolName, argsArray: preflight.argsArray }, preflightResult, { turn, toolIndex: i, messages, executedSteps, preflight });
      }

      hooks.onBeforeTool?.(toolCall, { turn, toolIndex: i, messages, executedSteps });

      let result = await executeToolCall(toolCall.name, toolCall.argsArray);
      let recovery = null;

      if (!result?.success) {
        recovery = maybeRecoverToolCall(toolCall.name, toolCall.argsArray, result, executedSteps, command);
        if (recovery) {
          hooks.onLog?.(`[ToolLoop] 本地恢复：${toolCall.name} -> ${recovery.toolName}，原因：${recovery.recoveryReason}`, 'warning');
          hooks.onRecovery?.(toolCall, recovery, result, { turn, toolIndex: i, messages, executedSteps });
          result = await executeToolCall(recovery.toolName, recovery.argsArray);
        }
      }

      executedSteps.push({
        turn: turn + 1,
        tool: recovery?.toolName || toolCall.name,
        originalTool: toolCall.name,
        args: recovery?.argsArray || toolCall.argsArray,
        originalArgs: toolCall.argsArray,
        guardReason: toolCall.guardReason || null,
        originalBlockedTool: toolCall.originalBlockedTool || null,
        recovery,
        result
      });

      hooks.onAfterTool?.(toolCall, result, { turn, toolIndex: i, messages, executedSteps, recovery });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.name,
        content: JSON.stringify({
          ...result,
          guardReason: toolCall.guardReason || null,
          originalBlockedTool: toolCall.originalBlockedTool || null,
          recovery: recovery || null,
          originalArgs: toolCall.argsArray,
          executedArgs: recovery?.argsArray || toolCall.argsArray
        })
      });
    }
  }

  const final = '达到最大 tool loop 轮数，任务提前结束。';
  hooks.onLog?.(`[ToolLoop] 达到最大轮数 maxTurns=${maxTurns}，任务提前结束。`, 'warning');
  hooks.onFinal?.(final, { turn: maxTurns, messages, executedSteps, maxTurnsReached: true });
  return {
    success: false,
    final,
    turns: maxTurns,
    steps: executedSteps,
    messages,
    error: final
  };
}

export async function executeCommand(command) {
  return runToolLoop(command);
}

export { buildFallbackFinalText, buildPreflightToolCall, maybeRecoverToolCall };

export function getToolList() {
  return TOOLS;
}
