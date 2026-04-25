window.TEXT2VOICE_TTS = {
    // 填入部署后的 Cloudflare Worker 地址，例如：
    // endpoint: 'https://text2voice-tts.your-subdomain.workers.dev/tts',
    endpoint: 'https://text2voice-tts.dreamforme.workers.dev/tts',
    enabled: true,
    timeoutMs: 12000,
    maxTextLength: 300,
    voiceOptions: [
        { id: 'x4_xiaoyan', label: '讯飞小燕（中英普通话）', lang: 'CN' },
        { id: 'xiaoyan', label: '小燕（兼容）', lang: 'CN' },
        { id: 'xiaoyu', label: '小宇（男声）', lang: 'CN' },
        { id: 'xiaoqi', label: '小琪（女声）', lang: 'CN' },
        { id: 'catherine', label: 'Catherine（英文女声）', lang: 'EN' },
        { id: 'henry', label: 'Henry（英文男声）', lang: 'EN' }
    ]
};
