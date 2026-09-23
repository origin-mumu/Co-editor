# Co-editor (协同编辑器)

> 基于 DOM 渲染与 Block 架构的现代高质感轻量级协同编辑器系统

---

## 📌 项目简介

Co-editor 是一个基于 **原生 DOM 块级渲染 (Block-based)** 与 **原生 WebSocket 通信** 的高质感协同编辑器系统。

项目严格遵循现代 Web 全栈 Monorepo 治理标准与 Apple iOS / Bento 毛玻璃设计系统规范，自研实现轻量级并发仲裁与网络自愈机制，旨在以最纯粹、清晰、可控的工程代码解决分布式文档协同核心痛点。

---

## 🏗️ 核心特性

- **Block 块级架构**：文档由独立的有序 Block 列表构成，天然实现跨段落协同零冲突。
- **并发仲裁与数据防腐**：
  - **交互层**：Block Focus 协作租约感知，正在编辑的块呈现高亮与协作者标签。
  - **数据层**：服务端 Versioned CAS (Compare-And-Swap) 原子比对，落实 First Write Wins 冲突裁决。
- **操作幂等防重 (Idempotency)**：全局唯一 `txId` 结合服务端滑动窗口缓存，彻底解决网络抖动与超时重发导致的重复修改。
- **断网自愈与状态恢复**：客户端四态网络状态机，离线输入自动存入 `pendingQueue`，重连后握手对齐快照并重放未确认事务。
- **高质感现代 UI**：Apple iOS 系统级设计美学（科技蓝 `#3E6FDC` + Grouped 浅灰底色 `#F2F2F7` + 100% 全胶囊纯平按钮 + 悬浮毛玻璃工具条 + 纯矢量 SVG 状态指示）。

---

## 📐 架构与规范文档

详细设计思路、追问解析与代码红线请查阅：
- [协同编辑器开发方案与技术规范](./协同编辑器开发方案与技术规范.md)
- [代码规范与工程准则 (单文件≤500行、零any)](./代码规范与工程准则.md)
- [原始需求说明](./文件.md)

---

## 🛠️ 技术栈

- **前端 (apps/web)**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **后端 (apps/api)**: Node.js, TypeScript, 原生 `ws` 库
- **协议层 (packages/shared)**: 跨端纯 TypeScript 协议定义与类型守卫
- **工程治理**: pnpm workspace (Monorepo)

---

## 🚀 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 启动全栈开发环境
pnpm dev
```
启动后在两个不同的浏览器窗口分别访问 `http://localhost:5173` 即可体验实时双向协同。
