(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.Text2VoiceTTS = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function normalizeEndpoint(endpoint) {
        return String(endpoint || '').trim().replace(/\/+$/, '');
    }

    function getTtsConfig(rawConfig) {
        const source = rawConfig || {};
        return {
            endpoint: normalizeEndpoint(source.endpoint),
            enabled: source.enabled !== false,
            timeoutMs: Number(source.timeoutMs) > 0 ? Number(source.timeoutMs) : 12000,
            maxTextLength: Number(source.maxTextLength) > 0 ? Number(source.maxTextLength) : 300,
            voiceOptions: getVoiceOptions(source)
        };
    }

    function shouldUseCloudTts(config) {
        const normalized = getTtsConfig(config);
        return normalized.enabled && normalized.endpoint.length > 0;
    }

    function getCloudLanguage(currentLang) {
        return currentLang === 'EN' ? 'en' : 'zh';
    }

    function buildTtsPayload(text, currentLang, rate, selectedVoice) {
        const voice = String(selectedVoice || '').trim();
        return {
            text: String(text || '').trim(),
            lang: getCloudLanguage(currentLang),
            voice: voice || (currentLang === 'EN' ? 'EN' : 'CN'),
            rate: Number(rate) || 1
        };
    }

    function getVoiceOptions(rawConfig) {
        const options = Array.isArray(rawConfig?.voiceOptions) ? rawConfig.voiceOptions : [];
        return options
            .filter((option) => option && option.id && option.label && option.lang)
            .map((option) => ({
                id: String(option.id).trim(),
                label: String(option.label).trim(),
                lang: option.lang === 'EN' ? 'EN' : 'CN'
            }))
            .filter((option) => option.id && option.label);
    }

    return {
        normalizeEndpoint,
        getTtsConfig,
        shouldUseCloudTts,
        getCloudLanguage,
        buildTtsPayload,
        getVoiceOptions
    };
});
