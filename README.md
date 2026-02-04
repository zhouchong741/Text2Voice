# Voice Loop | 循环朗读助手

这是一个基于 Web Speech API 的在线循环朗读工具，专为记忆训练、背单词或听力练习设计。无需后端，纯前端实现。

## ✨ 功能特点

*   **智能循环**：自定义间隔时间（默认30秒），在间隔内自动多次朗读（默认3次）。
*   **深色模式**：采用 Deepmind 风格的玻璃拟态（Glassmorphism）设计，专注沉浸。
*   **离线可用**：基于浏览器原生能力，无需联网即可发声。
*   **可视化进度**：清晰的倒计时圆环和进度条。

## 🚀 如何部署 (GitHub Pages)

本项目已配置为支持 GitHub Actions 自动部署。

### 方法一：直接使用 GitHub Actions (推荐)

1.  将本项目代码上传至 GitHub 仓库。
2.  进入仓库 **Settings (设置)** -> **Pages (页面)**。
3.  在 **Build and deployment (构建与部署)** 下的 **Source (来源)** 选项中，选择 **GitHub Actions**。
4.  Git 会自动识别 `.github/workflows/static.yml` 并开始部署。
5.  稍等片刻，你的网站即可通过 `https://<你的用户名>.github.io/<仓库名>/` 访问。

### 方法二：传统分支部署

1.  将代码上传至 GitHub。
2.  进入 **Settings** -> **Pages**。
3.  在 **Source** 中选择 **Deploy from a branch**。
4.  选择 `main` (或 `master`) 分支作为来源。
5.  保存即可，等待部署完成。

## 🛠️ 本地运行

无需安装任何依赖（如 Node.js），只需：

1.  下载代码。
2.  双击打开 `index.html`。
    *   *注意：部分浏览器可能限制本地文件的语音 API 权限，建议使用 VS Code 的 "Live Server" 插件运行，或者简单的 python 服务：`python -m http.server`*
