const DEFAULT_AZURE_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const DEFAULT_CN_VOICE = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_EN_VOICE = 'en-US-JennyNeural';

export default {
    async fetch(request, env) {
        const corsHeaders = buildCorsHeaders(env);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const url = new URL(request.url);
        if (url.pathname !== '/tts') {
            return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
        }

        if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
        }

        try {
            const body = await request.json();
            const text = String(body.text || '').trim();
            const lang = normalizeLang(body.lang);
            const maxTextLength = Number(env.MAX_TEXT_LENGTH || 300);

            if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
                return jsonResponse({ error: 'Azure Speech is not configured' }, 503, corsHeaders);
            }

            if (!text) {
                return jsonResponse({ error: 'Missing text' }, 400, corsHeaders);
            }

            if (text.length > maxTextLength) {
                return jsonResponse({ error: `Text is longer than ${maxTextLength} characters` }, 413, corsHeaders);
            }

            const voice = selectVoice(env, lang);
            const ssml = buildSsml(text, voice, lang, body.rate);
            const audioResponse = await synthesizeWithAzure(env, ssml);
            const headers = new Headers(audioResponse.headers);
            headers.set('Access-Control-Allow-Origin', corsHeaders.get('Access-Control-Allow-Origin'));
            headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
            headers.set('Access-Control-Allow-Headers', 'Content-Type');
            headers.set('Cache-Control', 'no-store');
            headers.set('Content-Type', 'audio/mpeg');

            return new Response(audioResponse.body, {
                status: audioResponse.status,
                headers
            });
        } catch (error) {
            console.error(JSON.stringify({
                message: 'tts_request_failed',
                error: error instanceof Error ? error.message : String(error)
            }));
            return jsonResponse({ error: 'TTS failed' }, 502, corsHeaders);
        }
    }
};

async function synthesizeWithAzure(env, ssml) {
    const region = String(env.AZURE_SPEECH_REGION).trim();
    const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/ssml+xml',
            'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
            'X-Microsoft-OutputFormat': env.AZURE_OUTPUT_FORMAT || DEFAULT_AZURE_FORMAT,
            'User-Agent': 'Text2Voice'
        },
        body: ssml
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Azure Speech failed: ${response.status} ${detail.slice(0, 200)}`);
    }

    return response;
}

function selectVoice(env, lang) {
    if (lang === 'en-US') {
        return env.AZURE_VOICE_EN || DEFAULT_EN_VOICE;
    }

    return env.AZURE_VOICE_CN || DEFAULT_CN_VOICE;
}

function buildSsml(text, voice, lang, rawRate) {
    const rate = normalizeRate(rawRate);
    const escapedText = escapeXml(addReadingPause(text, lang));

    return [
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"',
        ` xml:lang="${lang}">`,
        `<voice name="${voice}">`,
        `<prosody rate="${rate}">${escapedText}</prosody>`,
        '</voice>',
        '</speak>'
    ].join('');
}

function addReadingPause(text, lang) {
    if (/[。！？.!?]$/.test(text)) {
        return text;
    }

    return lang === 'zh-CN' ? `${text}。` : `${text}.`;
}

function normalizeRate(rate) {
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate)) return '0%';

    const percent = Math.round((Math.min(Math.max(numericRate, 0.5), 2) - 1) * 100);
    return `${percent >= 0 ? '+' : ''}${percent}%`;
}

function buildCorsHeaders(env) {
    return new Headers({
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin'
    });
}

function normalizeLang(lang) {
    return lang === 'en' ? 'en-US' : 'zh-CN';
}

function jsonResponse(body, status, headers) {
    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8');

    return new Response(JSON.stringify(body), {
        status,
        headers: responseHeaders
    });
}

function escapeXml(value) {
    return String(value).replace(/[<>&'"]/g, (char) => {
        switch (char) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case "'": return '&apos;';
            case '"': return '&quot;';
            default: return char;
        }
    });
}
