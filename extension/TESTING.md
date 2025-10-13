# Chrome 扩展测试指南

## 快速开始

### 1. 准备图标（可选，测试时可跳过）

**方法 A：使用图标生成器**
```bash
cd assets
open create-icons.html  # 在浏览器中打开
# 保存生成的 4 个 PNG 文件到 assets/ 目录
```

**方法 B：使用占位图标**
你可以暂时使用任何 PNG 图片，或者直接注释掉 manifest.json 中的图标引用。

### 2. 在 Chrome 中加载扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 右上角开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择目录：`/Users/sagasu/Downloads/epic-chrome-translation-plugin/extension`
6. 扩展将出现在扩展列表中

### 3. 配置 API 密钥

1. 点击扩展图标 → 点击「Settings」
2. 在「API Configuration」标签页输入你的 Gemini API Key
   - 获取免费 API Key：https://aistudio.google.com/app/apikey
3. 点击「Validate」验证密钥
4. 点击「💾 Save Settings」保存

### 4. 测试翻译功能

**方法 1：使用浮动按钮**
1. 访问任意英文网页（如 https://github.com）
2. 页面右侧会出现蓝色浮动按钮
3. 点击按钮开始翻译
4. 等待翻译完成（进度显示）
5. 译文会显示在原文下方

**方法 2：使用弹出窗口**
1. 点击浏览器工具栏的扩展图标
2. 在弹出窗口点击「🌐 Translate Page」
3. 查看翻译状态和进度

## 测试检查清单

### 基础功能
- [ ] 扩展成功加载，无报错
- [ ] 可以打开设置页面
- [ ] 可以保存 API 密钥
- [ ] 可以打开弹出窗口

### 翻译功能
- [ ] 浮动按钮在页面上显示
- [ ] 点击按钮触发翻译
- [ ] 进度指示器工作
- [ ] 译文正确插入到原文下方
- [ ] 可以切换显示/隐藏译文

### 设置功能
- [ ] 可以切换目标语言
- [ ] 可以切换翻译引擎
- [ ] 显示设置实时预览工作
- [ ] 黑名单添加/删除功能
- [ ] 统计数据正确显示

### 高级功能
- [ ] 动态加载的内容会自动翻译
- [ ] 缓存功能工作（重复翻译相同段落不消耗 API）
- [ ] 黑名单网站不显示浮动按钮
- [ ] 不同网页的翻译状态独立

## 常见问题

### 扩展加载失败
**错误：** "Manifest file is invalid"
- 检查 manifest.json 语法
- 确认所有引用的文件都存在
- 临时移除图标引用（如果图标文件不存在）

### 翻译不工作
1. 检查 API 密钥是否正确配置
2. 打开开发者工具（F12）查看 Console 错误
3. 检查网络请求是否成功
4. 确认 API 配额未用尽

### 浮动按钮不显示
1. 检查内容脚本是否注入成功
2. 打开开发者工具 → Elements，搜索 `csta-floating-button`
3. 检查控制台是否有 CSS 加载错误
4. 确认页面 URL 匹配 `https://*/*`（http 页面不支持）

### 样式错误
1. 检查 CSS 文件是否正确加载
2. 查看是否与页面原有样式冲突
3. 检查 Content Security Policy 限制

## 调试技巧

### 查看后台日志
```
chrome://extensions/ → 点击「Service Worker」→ 查看 Console
```

### 查看内容脚本日志
```
在任意页面 → F12 打开开发者工具 → Console 标签
```

### 查看存储内容
```javascript
// 在 Console 中执行
chrome.storage.sync.get(null, (data) => console.log('Settings:', data));
chrome.storage.local.get(null, (data) => console.log('Cache:', data));
```

### 重新加载扩展
修改代码后需要：
1. 访问 `chrome://extensions/`
2. 点击扩展卡片上的「🔄 重新加载」按钮
3. 刷新测试页面

## 推荐测试网站

### 英文内容网站
- GitHub: https://github.com
- Medium: https://medium.com
- TechCrunch: https://techcrunch.com
- Wikipedia: https://en.wikipedia.org

### 技术文档网站
- MDN: https://developer.mozilla.org
- React Docs: https://react.dev
- Chrome Developers: https://developer.chrome.com

### 动态内容网站（测试 MutationObserver）
- Twitter/X: https://twitter.com
- Reddit: https://reddit.com

## 性能测试

### 大型页面
- 长文章（>100 段落）
- 检查首屏渲染时间 <2 秒
- 检查内存使用正常

### 缓存测试
1. 翻译一个页面
2. 刷新页面重新翻译
3. 检查控制台日志显示「Found X/Y paragraphs in cache」
4. 确认第二次翻译更快

## 报告问题

如发现 Bug，请提供：
1. Chrome 版本
2. 扩展版本（0.1.0）
3. 复现步骤
4. Console 错误日志截图
5. 测试网页 URL

GitHub Issues: https://github.com/s87343472/local001/issues
