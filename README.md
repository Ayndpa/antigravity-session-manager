# Antigravity Session Manager / Antigravity 会话管理器

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## English

Antigravity Session Manager is a desktop application built with Tauri, React, and TypeScript, designed to provide a sleek, performant interface for managing Antigravity projects and sessions.

> [!WARNING]
> **Important Note:** This software is specifically designed for managing Antigravity projects and sessions. It is **NOT** intended or designed to be used for switching user accounts.

### Features
- **Session & Project Management**: Easily manage, configure, and switch between your Antigravity project directories and sessions.
- **Batch Operations**: Support for batch importing, exporting, adding, and deleting project directories.
- **Advanced Selection Modifiers**: Multi-selection and range selection supported using standard keyboard modifiers (`Ctrl + Click` to toggle/multi-select, `Shift + Click` for range selection).
- **Multi-language Support**: Seamless toggle between English and Chinese.
- **Modern Responsive Design**: Premium glassmorphism UI with customized themes and interactive micro-animations.

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS.
- **Backend**: Rust, Tauri v2.

---

### Getting Started

#### Prerequisites
Before compiling and running the application, make sure you have the following installed on your system:

1. **Rust & Cargo**: Follow the installation guide at [rustup.rs](https://rustup.rs/).
2. **Node.js or Bun**:
   - [Node.js](https://nodejs.org/) (v18 or higher recommended)
   - Or [Bun](https://bun.sh/) (a `bun.lock` is included in the project, which is highly recommended for faster builds).
3. **Windows Build Tools** (since the development OS is Windows):
   - Make sure you have the C++ Build Tools installed via the Visual Studio Installer.
   - WebView2 Runtime (usually pre-installed on Windows 10/11).

Refer to the official [Tauri Windows Setup Guide](https://v2.tauri.app/start/prerequisites/#windows) for details.

#### Installation & Development

1. **Clone the repository and navigate into it**:
   ```bash
   cd antigravity-session-manager
   ```

2. **Install frontend dependencies**:
   Using Bun:
   ```bash
   bun install
   ```
   Using npm:
   ```bash
   npm install
   ```

3. **Run the development server**:
   This command starts the Vite frontend dev server and compiles the Tauri Rust backend in development mode, automatically opening the application window.
   Using Bun:
   ```bash
   bun run tauri dev
   ```
   Using npm:
   ```bash
   npm run tauri dev
   ```

#### Compiling for Production

To package the application into a standalone production installer or executable:

Using Bun:
```bash
bun run tauri build
```
Using npm:
```bash
npm run tauri build
```

The output installers and binaries will be located under the `src-tauri/target/release/bundle/` directory.

---

<a name="中文"></a>
## 中文

Antigravity 会话管理器是一个基于 Tauri、React 和 TypeScript 开发的桌面应用程序，旨在为管理 Antigravity 项目和会话提供流畅、高效的用户界面。

> [!WARNING]
> **重要说明：** 本软件专用于管理 Antigravity 的项目与会话，**并非**用于切换用户账号。请勿将其作为账号切换工具使用。

### 功能特性
- **会话与项目管理**：便捷地管理、配置和切换 Antigravity 的项目目录和会话。
- **批量操作**：支持项目目录的批量导入、导出、添加和删除。
- **高级选择交互**：支持标准键盘修饰键选择（`Ctrl + 点击` 进行多选或反选，`Shift + 点击` 进行区间范围选择）。
- **多语言支持**：界面支持在中英文之间无缝切换。
- **现代化响应式界面**：高端磨砂玻璃质感（Glassmorphism）UI，带有个性化主题和细腻的微交互动画。

### 技术栈
- **前端**：React 19, TypeScript, Vite, Vanilla CSS。
- **后端**：Rust, Tauri v2。

---

### 快速开始

#### 环境准备
在编译和运行本项目之前，请确保您的系统上已安装以下依赖：

1. **Rust & Cargo**：请参考 [rustup.rs](https://rustup.rs/) 进行安装。
2. **Node.js 或 Bun**：
   - [Node.js](https://nodejs.org/)（建议 v18 或更高版本）
   - 或 [Bun](https://bun.sh/)（项目包含 `bun.lock`，推荐使用 Bun 以获得更快的构建速度）。
3. **Windows 编译工具**（由于开发环境为 Windows）：
   - 请确保通过 Visual Studio Installer 安装了 C++ 编译工具。
   - WebView2 运行时（Windows 10/11 通常已自带内置）。

具体细节请参阅 [Tauri 官方 Windows 环境配置指南](https://v2.tauri.app/start/prerequisites/#windows)。

#### 开发运行步骤

1. **克隆项目并进入目录**：
   ```bash
   cd antigravity-session-manager
   ```

2. **安装前端依赖**：
   使用 Bun：
   ```bash
   bun install
   ```
   使用 npm：
   ```bash
   npm install
   ```

3. **运行开发模式**：
   此命令将启动 Vite 前端开发服务器，并在开发模式下编译 Tauri Rust 后端，然后自动打开应用窗口。
   使用 Bun：
   ```bash
   bun run tauri dev
   ```
   使用 npm：
   ```bash
   npm run tauri dev
   ```

#### 编译打包（生产环境）

要将应用程序打包为独立安装包或可执行文件，请运行：

使用 Bun：
```bash
bun run tauri build
```
使用 npm：
```bash
npm run tauri build
```

打包生成的安装包和二进制文件将位于 `src-tauri/target/release/bundle/` 目录下。
