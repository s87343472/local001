# 设置页面调试指南

## 问题描述

**症状：** 设置页面只显示「API Configuration」标签，无法切换到其他标签，保存按钮无响应。

## 诊断步骤

### 1. 检查控制台日志

1. 打开设置页面（扩展图标 → Settings）
2. 按 F12 打开开发者工具
3. 切换到 Console 标签
4. 查找以下日志：

**正常情况应该看到：**
```
Options module loaded successfully
DOM ready, initializing OptionsManager...
[Options] Starting initialization...
[Options] Loading settings...
[Options] Initializing tab navigation...
[Options] Initializing event listeners...
[Options] Handling URL parameters...
[Options] Initialization complete!
OptionsManager initialized successfully
```

**如果出现错误：**
- `Failed to resolve module specifier` → ES6 模块路径问题
- `Uncaught TypeError` → JavaScript 代码错误
- `Chrome runtime error` → 与 background script 通信失败
- 什么都没有 → JavaScript 文件未加载

### 2. 检查网络请求

1. 开发者工具 → Network 标签
2. 刷新设置页面
3. 检查以下文件是否成功加载（状态码 200）：
   - `options.html`
   - `options.js`
   - `options.css`
   - `lib/message-router.js`
   - `lib/storage.js`

**如果看到 404 错误** → 文件路径配置问题

### 3. 检查 Sources 面板

1. 开发者工具 → Sources 标签
2. 左侧文件树中找到：
   ```
   chrome-extension://[extension-id]/
   ├── options/
   │   ├── options.html
   │   ├── options.js
   │   └── options.css
   └── lib/
       ├── message-router.js
       └── storage.js
   ```

**如果文件不在树中** → manifest.json 配置问题

### 4. 手动测试模块加载

在控制台执行：

```javascript
// 测试 MessageRouter 导入
import('../lib/message-router.js')
  .then(module => console.log('MessageRouter loaded:', module))
  .catch(error => console.error('Failed to load MessageRouter:', error));

// 测试 StorageManager 导入
import('../lib/storage.js')
  .then(module => console.log('StorageManager loaded:', module))
  .catch(error => console.error('Failed to load StorageManager:', error));
```

### 5. 检查存储数据

在控制台执行：

```javascript
// 检查同步存储
chrome.storage.sync.get(null, data => {
  console.log('Sync storage:', data);
});

// 检查本地存储
chrome.storage.local.get(null, data => {
  console.log('Local storage:', data);
});
```

**预期结果：**
```javascript
{
  version: "0.1.0",
  preferences: { targetLanguage: "zh-CN", ... },
  displaySettings: { translationColor: "#666666", ... },
  blacklist: [...],
  statistics: {...}
}
```

## 常见问题和解决方案

### 问题 1：模块无法加载

**错误信息：**
```
Failed to resolve module specifier "../lib/message-router.js"
```

**原因：** ES6 模块路径解析问题

**解决方案：**
1. 检查 `manifest.json` 中的 `web_accessible_resources`
2. 确保所有 `.js` 文件在正确的目录
3. 重新加载扩展

### 问题 2：Background Script 未响应

**症状：** 控制台显示 `[Options] Loading settings...` 后卡住

**原因：** Background service worker 未运行或崩溃

**解决方案：**
1. 访问 `chrome://extensions/`
2. 找到扩展卡片
3. 点击「Service Worker」链接
4. 查看 background 日志
5. 如果显示 "Inactive"，点击一次设置页面激活它

### 问题 3：标签导航无响应

**症状：** 点击标签按钮没有任何反应

**检查：**
```javascript
// 在控制台执行
const navItems = document.querySelectorAll('.nav-item');
console.log('Nav items found:', navItems.length);
navItems.forEach((item, i) => {
  console.log(`Nav ${i}:`, item.dataset.tab, item.classList.contains('active'));
});
```

**预期输出：** 应该找到 6 个 nav-item（api, preferences, display, blacklist, stats, about）

**如果输出为 0** → HTML 结构问题或 CSS 隐藏元素

### 问题 4：保存按钮无响应

**检查事件监听器：**
```javascript
// 在控制台执行
const saveBtn = document.getElementById('save-settings');
console.log('Save button:', saveBtn);
console.log('Has click listener:', saveBtn ? getEventListeners(saveBtn).click : 'Button not found');
```

**预期：** 应该显示 button 元素和至少 1 个 click 监听器

### 问题 5：数据无法保存

**测试存储写入：**
```javascript
// 在控制台执行
chrome.storage.sync.set({test: 'value'}, () => {
  if (chrome.runtime.lastError) {
    console.error('Storage write failed:', chrome.runtime.lastError);
  } else {
    console.log('Storage write successful');
    chrome.storage.sync.get('test', data => console.log('Read back:', data));
  }
});
```

## 手动修复步骤

如果自动诊断无效，尝试以下步骤：

### 步骤 1：重新加载扩展

1. 访问 `chrome://extensions/`
2. 找到 "Chrome Smart Translation Assistant"
3. 点击右下角的「🔄 重新加载」按钮
4. 等待 2-3 秒
5. 重新打开设置页面

### 步骤 2：清除扩展数据

```javascript
// 在控制台执行 - 警告：这会清除所有设置！
chrome.storage.sync.clear(() => {
  console.log('Sync storage cleared');
});
chrome.storage.local.clear(() => {
  console.log('Local storage cleared');
});

// 然后重新加载扩展
location.reload();
```

### 步骤 3：检查文件完整性

确认以下文件存在且未损坏：

```bash
cd /Users/sagasu/Downloads/epic-chrome-translation-plugin/extension

# 检查文件
ls -la options/options.html
ls -la options/options.js
ls -la options/options.css
ls -la lib/message-router.js
ls -la lib/storage.js

# 检查文件不为空
wc -l options/options.js  # 应该 > 600 行
wc -l lib/message-router.js  # 应该 > 100 行
```

### 步骤 4：验证 manifest.json

检查 `manifest.json` 包含：

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

## 收集调试信息

如果问题仍未解决，收集以下信息：

1. **浏览器版本：**
   - 地址栏输入 `chrome://version/`
   - 复制 Chrome 版本号

2. **扩展版本：**
   - `chrome://extensions/` 查看扩展版本（应该是 0.1.0）

3. **控制台完整日志：**
   - 打开设置页面
   - F12 → Console
   - 右键点击日志区域 → "Save as..."
   - 保存为 `console-log.txt`

4. **Network 请求日志：**
   - F12 → Network
   - 勾选 "Preserve log"
   - 刷新页面
   - 右键 → "Save all as HAR"

5. **Background 日志：**
   - `chrome://extensions/`
   - 点击 "Service Worker"
   - 复制控制台输出

## 报告问题

将收集的信息提交到：
- GitHub Issues: https://github.com/s87343472/local001/issues
- 标题格式：`[Bug] Settings page navigation/save not working`
- 包含：浏览器版本、控制台日志、复现步骤

## 临时解决方案

在修复之前，可以通过控制台直接保存设置：

```javascript
// 手动保存 API 密钥
chrome.storage.sync.set({
  apiKeys: {
    gemini: 'YOUR_API_KEY_HERE'
  }
}, () => console.log('API key saved'));

// 手动保存偏好设置
chrome.storage.sync.set({
  preferences: {
    targetLanguage: 'zh-CN',
    defaultEngine: 'gemini',
    professionalDomain: 'computer',
    translationMode: 'smart',
    autoTranslate: false
  }
}, () => console.log('Preferences saved'));
```

## 已知问题

- [ ] 首次加载可能需要 1-2 秒初始化
- [ ] Background service worker 可能进入休眠状态
- [ ] 某些网站的 CSP 可能阻止内容脚本

## 更新日志

- 2025-10-13: 添加详细错误处理和日志
- 2025-10-13: 修复 .status-message.info CSS 类缺失问题
