# Voice Loop | 循环朗读助手

这是一个在线循环朗读工具，专为低年级听写训练、背单词或听力练习设计。页面仍然可以部署在 GitHub Pages；朗读优先使用 Cloudflare Worker 中转的自然语音，失败时自动退回浏览器原生 Web Speech API。

## ✨ 功能特点

*   **智能循环**：自定义间隔时间（默认30秒），在间隔内自动多次朗读（默认3次）。
*   **深色模式**：采用 Deepmind 风格的玻璃拟态（Glassmorphism）设计，专注沉浸。
*   **自然语音优先**：通过 Cloudflare Worker 中转 Azure Speech 神经语音，发音比浏览器原生声音更自然。
*   **原生语音兜底**：Worker 未配置、网络失败或额度用尽时，自动使用浏览器原生 Web Speech API。
*   **离线兜底**：未配置云端 TTS 时，仍可依赖浏览器原生能力发声。
*   **可视化进度**：清晰的倒计时圆环和进度条。

## 🔊 自然语音配置

GitHub Pages 是纯静态托管，不能把任何 TTS API Key 放到前端。推荐结构：

```text
GitHub Pages 页面 -> Cloudflare Worker /tts -> Azure Speech TTS
```

本仓库已内置一个 Worker 示例，默认使用：

```text
中文：zh-CN-XiaoxiaoNeural
英文：en-US-JennyNeural
```

Azure Speech 的中文短词发音比 MeloTTS 更稳定，更适合听写。Cloudflare Worker 只负责隐藏 Azure Key，并把前端请求转成 Azure Speech REST API 调用。

### Azure Speech TTS 是否免费？

结论：**小规模家用大概率能落在免费额度里，但不是无限免费。**

Cloudflare Worker 本身有免费请求额度。Azure Speech `F0` 免费层通常提供每月 `500,000` 字符的神经语音额度。Azure 计费说明里中文汉字按 2 个字符计，所以约等于每月 `250,000` 个汉字，听写类短词/短句一般够用。

超过免费额度后，Azure 免费层通常会限流或拒绝请求。建议在 Azure 里设置预算提醒。

### 部署 Worker

进入 Worker 目录：

```bash
cd worker
npm install
npm run deploy
```

部署后需要把 Azure Speech Key 写入 Cloudflare Worker secret：

```bash
echo "<你的 Azure Speech Key>" | npx wrangler secret put AZURE_SPEECH_KEY
```

默认区域是 `eastus`。如果你的 Azure Speech 资源不是 `eastus`，修改 `worker/wrangler.jsonc` 里的 `AZURE_SPEECH_REGION` 后重新部署。

部署完成后会得到类似地址：

```text
https://text2voice-tts.<你的子域>.workers.dev
```

把 `config.js` 里的 `endpoint` 改成：

```js
window.TEXT2VOICE_TTS = {
    endpoint: 'https://text2voice-tts.<你的子域>.workers.dev/tts',
    enabled: true,
    timeoutMs: 12000,
    maxTextLength: 300
};
```

然后把代码推送到 GitHub Pages 即可。

### 限制建议

*   `MAX_TEXT_LENGTH` 默认是 300，避免一次提交太长导致费用不可控。
*   如果只给自己的 GitHub Pages 使用，建议把 `worker/wrangler.jsonc` 里的 `ALLOWED_ORIGIN` 从 `*` 改成你的 Pages 域名。
*   云端 TTS 需要联网；离线时会自动退回浏览器原生朗读。

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
