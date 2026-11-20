# WordScan · 单词扫描对比小程序

拍照或选择两张图片，AI 自动标注出两张图片中**相同或同义**的英文单词——每组配对使用不同颜色的下划线，直观呈现词汇关联。

纯前端实现，无需后端服务器，直连 DeepSeek 官方 API。

## 功能特性

- 📷 **拍照 / 相册选图**：两张图片任意组合获取
- 🤖 **DeepSeek 多模态大模型**：一次请求同时完成 OCR 识别 + 同义词分析 + 位置定位
- 🌈 **彩色下划线标注**：10 色调色板循环分配，每组配对颜色独立、区分度高
- 📋 **配对图例**：列出每组的单词、颜色与关系（相同/同义）
- 💾 **保存到相册**：一键导出两张标注图
- 🔒 **隐私安全**：API Key 仅存储在本机 Storage，图片不落任何服务器

## 快速开始

1. 下载安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本项目目录（测试号即可，AppID 可先用工具提供的测试号）
3. 在 [DeepSeek 开放平台](https://platform.deepseek.com) 创建 API Key
4. 运行小程序 → 首页填入 Key → 选择两张含英文单词的图片 → 点击「开始对比」

> 提示：请在开发者工具「详情 → 本地设置」中勾选「不校验合法域名」（正式发布需在小程序后台把 `https://api.deepseek.com` 加入 request 合法域名）。

## 技术架构

```
wx.chooseMedia ──► base64 编码
                      │
                      ▼
        DeepSeek /chat/completions (deepseek-flash)
        两图同传，返回 JSON：配对组 + 归一化 bbox(0-1000)
                      │
                      ▼
        utils/analyzer.js：JSON 解析、bbox 清洗、去重、调色
                      │
                      ▼
        Canvas 2D 绘制：图片 + 彩色下划线（粗细随字号自适应）
```

- **prompt 设计**（utils/api.js）：强制 JSON 输出（`response_format: json_object`），坐标系归一化 0-1000，实测 bbox 误差 <1%
- **防御式解析**（utils/analyzer.js）：剥离 markdown 代码块、bbox 越界裁剪与翻转修正、非法条目剔除、重复组去重
- **绘制**（pages/result/result.js）：等比缩放适配 Canvas，下划线粗度 = 单词高度 × 8%，线尾圆点强化颜色区分

## 目录结构

```
├── app.js / app.json / app.wxss
├── pages/
│   ├── index/     # 拍照/选图 + API Key 管理
│   └── result/    # Canvas 标注绘制 + 图例 + 保存
├── utils/
│   ├── api.js     # DeepSeek 请求封装（prompt + 多模态消息）
│   └── analyzer.js# 返回解析/校验/调色（纯函数，可单测）
└── test/          # Node 自测脚本（不影响小程序打包）
```

## 测试

```bash
# 单元测试（无需 API Key）
node test/run_tests.js

# 端到端真实 API 验收（需要 Key）
DS_API_KEY=sk-xxx node test/e2e.js
```

## 声明

本工具调用 DeepSeek 付费 API，费用由使用者自己的 Key 承担；模型定位框可能有细微偏差，属正常现象。