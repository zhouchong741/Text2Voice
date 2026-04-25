const assert = require('node:assert/strict');
const tts = require('../tts-utils');

assert.equal(tts.normalizeEndpoint(' https://example.com/tts/ '), 'https://example.com/tts');
assert.equal(tts.shouldUseCloudTts({ endpoint: '' }), false);
assert.equal(tts.shouldUseCloudTts({ endpoint: 'https://example.com/tts' }), true);
assert.equal(tts.shouldUseCloudTts({ endpoint: 'https://example.com/tts', enabled: false }), false);

assert.deepEqual(tts.buildTtsPayload(' Apple ', 'EN', '0.8'), {
    text: 'Apple',
    lang: 'en',
    voice: 'EN',
    rate: 0.8
});

assert.deepEqual(tts.buildTtsPayload(' Apple ', 'EN', '0.8', 'catherine'), {
    text: 'Apple',
    lang: 'en',
    voice: 'catherine',
    rate: 0.8
});

assert.deepEqual(tts.buildTtsPayload('苹果', 'CN', '1'), {
    text: '苹果',
    lang: 'zh',
    voice: 'CN',
    rate: 1
});

assert.deepEqual(tts.getVoiceOptions({
    voiceOptions: [
        { id: 'x4_xiaoyan', label: '讯飞小燕', lang: 'CN' },
        { id: '', label: 'bad', lang: 'CN' },
        { id: 'broken' }
    ]
}), [
    { id: 'x4_xiaoyan', label: '讯飞小燕', lang: 'CN' }
]);

console.log('tts-utils tests passed');
