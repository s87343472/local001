# 手动测试指南 - Reddit 翻译功能

## 问题诊断

自动化测试发现内容脚本未注入,这是因为 Puppeteer 启动的 Chrome 实例是**全新环境**,没有配置 API key。

## 手动测试步骤(推荐)

### 方法 1: 使用已配置的 Chrome

如果你已经在正常的 Chrome 中配置好了扩展:

#### 步骤

1. **打开已安装扩展的 Chrome**
2. **访问 Reddit**: https://www.reddit.com
3. **观察右侧**: 应该看到蓝色浮动按钮
4. **点击按钮**: 开始翻译
5. **验证中文**: 检查按钮文本是否为中文

#### 验证清单

- [ ] 浮动按钮出现
- [ ] 按钮文字: "点击翻译页面" (中文)
- [ ] 点击按钮触发翻译
- [ ] 按钮状态变化: 就绪 → 翻译中 → 已翻译
- [ ] 页面显示中文翻译
- [ ] 点击按钮打开面板
- [ ] 面板文字全是中文:
  - 智能翻译
  - 状态: 就绪
  - 翻译页面
  - 切换显示
  - 重新翻译
  - 引擎, 语言, 已翻译
  - 设置, 统计

---

### 方法 2: 全新测试(完整流程)

从零开始完整测试扩展:

#### 1. 加载扩展

```bash
# 打开 Chrome
# 访问 chrome://extensions/
# 开启"开发者模式"
# 点击"加载已解压的扩展程序"
# 选择: /Users/sagasu/Downloads/epic-chrome-translation-plugin/extension
```

#### 2. 配置 API Key

1. 点击扩展图标
2. 点击弹窗中的 "设置" (或打开 `chrome://extensions/` 点击 "扩展程序选项")
3. 在 "API Configuration" 标签输入 Gemini API Key
   - 获取: https://aistudio.google.com/app/apikey
4. 点击 "Validate" 验证
5. 点击 "💾 保存设置"

#### 3. 测试 Reddit 翻译

1. 新标签页打开: https://www.reddit.com
2. 等待页面加载完成(2-3秒)
3. 观察页面右侧中间位置
4. 应该看到**蓝色圆形浮动按钮**

**如果按钮没出现:**
- 按 F12 打开开发者工具
- 查看 Console 标签
- 检查是否有红色错误
- 截图发给我诊断

#### 4. 测试翻译功能

**步骤 A: 直接点击按钮**
1. 点击蓝色浮动按钮
2. 按钮变成橙色,显示进度
3. 等待 10-30 秒
4. 按钮变成绿色 ✓
5. 页面上原文下方出现中文翻译

**步骤 B: 通过面板操作**
1. 点击绿色按钮(已翻译状态)
2. 弹出控制面板
3. 检查面板文字:
   - 标题: "🌐 智能翻译" ✓
   - 状态: "已翻译 (X 可见)" ✓
   - 按钮: "切换显示", "重新翻译" ✓
4. 点击 "切换显示" 按钮
5. 翻译应该隐藏/显示

#### 5. 验证中文本地化

检查以下所有文字是否为中文:

**按钮 tooltip (鼠标悬停):**
- 就绪状态: "点击翻译页面"
- 翻译中: "翻译中..."
- 完成后: "翻译完成(点击切换)"

**控制面板:**
- 标题: "智能翻译"
- 状态标签: "状态:"
- 状态值: "就绪" / "翻译中..." / "已翻译"
- 按钮: "翻译页面", "切换显示", "重新翻译"
- 信息: "引擎:", "语言:", "已翻译:"
- 底部: "设置", "统计"

---

## 测试结果记录模板

请填写以下信息并贴回来:

```
### 测试环境
- Chrome 版本:
- 操作系统: macOS
- 扩展版本: 0.1.0
- 测试日期: 2025-10-14

### 基础功能
- [ ] 扩展成功加载
- [ ] API Key 配置成功
- [ ] 浮动按钮出现在 Reddit
- [ ] 按钮文字是中文

### 翻译功能
- [ ] 点击按钮触发翻译
- [ ] 状态正确变化 (就绪→翻译中→已翻译)
- [ ] 页面显示中文翻译
- [ ] 翻译内容正确

### 中文本地化
- [ ] 按钮 tooltip 全是中文
- [ ] 控制面板标题是中文
- [ ] 所有按钮标签是中文
- [ ] 状态消息是中文
- [ ] 信息标签是中文

### 控制功能
- [ ] 点击按钮打开面板
- [ ] 切换显示功能工作
- [ ] 重新翻译功能工作

### 问题/错误
(如果有问题,请描述并附上截图)

### 截图
请提供以下截图:
1. 浮动按钮出现(悬停显示 tooltip)
2. 点击按钮后翻译进行中
3. 翻译完成后的页面
4. 打开控制面板的截图
```

---

## 如果遇到问题

### 浮动按钮不出现

**检查 1: 内容脚本是否加载**
```javascript
// 在页面按 F12,在 Console 输入:
typeof FloatingButton
// 应该显示: "function"
// 如果显示 "undefined",说明内容脚本没加载
```

**检查 2: 查看扩展错误**
1. 访问 `chrome://extensions/`
2. 找到 "Chrome Smart Translation Assistant"
3. 点击 "错误" 查看是否有报错

**检查 3: 查看 Service Worker 日志**
1. 访问 `chrome://extensions/`
2. 点击 "Service Worker" (在扩展下方)
3. 查看 Console 是否有错误

### 翻译不工作

**检查 1: API Key 是否有效**
```javascript
// 在页面 Console 输入:
chrome.storage.sync.get(['apiKeys'], (data) => {
  console.log('API Keys configured:', !!data.apiKeys?.gemini);
});
```

**检查 2: 查看翻译请求**
1. F12 开发者工具
2. Network 标签
3. 点击翻译按钮
4. 查看是否有请求到 `generativelanguage.googleapis.com`
5. 检查请求状态码(应该是 200)

### 翻译显示乱码或空白

**检查渲染器:**
```javascript
// 在页面 Console 输入:
document.querySelectorAll('.csta-translation').length
// 应该 > 0,显示翻译的数量
```

---

## 快速验证命令

在 Reddit 页面 Console 运行:

```javascript
// 1. 检查内容脚本
console.log('Content Script Check:', {
  FloatingButton: typeof FloatingButton,
  ContentDetector: typeof ContentDetector,
  MessageRouter: typeof MessageRouter
});

// 2. 检查浮动按钮
const button = document.getElementById('csta-floating-button');
console.log('Button exists:', !!button);
if (button) {
  console.log('Button title:', button.getAttribute('title'));
  console.log('Button classes:', button.className);
}

// 3. 检查翻译
console.log('Translations rendered:',
  document.querySelectorAll('.csta-translation').length
);

// 4. 测试翻译函数
if (typeof window.translatePage === 'function') {
  console.log('✓ translatePage function available');
  // window.translatePage(); // 取消注释来触发翻译
} else {
  console.log('✗ translatePage function NOT available');
}
```

---

## 预期结果示例

**成功的 Console 输出应该是:**
```javascript
Content Script Check: {
  FloatingButton: "function",
  ContentDetector: "function",
  MessageRouter: "function"
}
Button exists: true
Button title: "点击翻译页面"
Button classes: "csta-btn csta-btn-idle"
✓ translatePage function available
```

**翻译后:**
```javascript
Translations rendered: 15
// (数字取决于 Reddit 页面内容数量)
```

---

## 成功标准

测试通过需要满足:

✅ 浮动按钮出现
✅ 按钮文字全是中文
✅ 点击按钮能触发翻译
✅ 翻译内容正确显示在原文下方
✅ 翻译内容是中文
✅ 控制面板所有文字是中文
✅ 切换显示功能正常

---

## 需要帮助?

如果测试遇到问题:

1. **截图**: 浮动按钮、控制面板、Console 错误
2. **Console 输出**: 运行上面的"快速验证命令"
3. **扩展错误**: `chrome://extensions/` 页面的错误信息
4. **描述**: 详细描述操作步骤和预期vs实际行为

发送到 GitHub Issue #12 评论区,我会帮你诊断!

---

**最后更新**: 2025-10-14
**测试目标**: 验证 Issue #12 所有修复,特别是中文本地化
