import {
    buildXunfeiAuthUrl,
    buildXunfeiPayload,
    collectXunfeiAudio,
    rateToXunfeiSpeed
} from './xunfei.js';

const DEFAULT_XUNFEI_VOICE = 'x4_xiaoyan';

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
            const maxTextLength = Number(env.MAX_TEXT_LENGTH || 300);

            if (!env.XUNFEI_APP_ID || !env.XUNFEI_API_KEY || !env.XUNFEI_API_SECRET) {
                return jsonResponse({ error: 'Xunfei TTS is not configured' }, 503, corsHeaders);
            }

            if (!text) {
                return jsonResponse({ error: 'Missing text' }, 400, corsHeaders);
            }

            if (text.length > maxTextLength) {
                return jsonResponse({ error: `Text is longer than ${maxTextLength} characters` }, 413, corsHeaders);
            }

            const audio = await synthesizeWithXunfei(env, {
                text: addReadingPause(text),
                voice: selectVoice(env, body.voice),
                speed: rateToXunfeiSpeed(body.rate)
            });
            const headers = new Headers(corsHeaders);
            headers.set('Cache-Control', 'no-store');
            headers.set('Content-Type', 'audio/mpeg');

            return new Response(audio, {
                status: 200,
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

async function synthesizeWithXunfei(env, { text, voice, speed }) {
    const authUrl = await buildXunfeiAuthUrl({
        apiKey: env.XUNFEI_API_KEY,
        apiSecret: env.XUNFEI_API_SECRET
    });
    const payload = buildXunfeiPayload({
        appId: env.XUNFEI_APP_ID,
        text,
        voice,
        speed
    });
    const socket = new WebSocket(authUrl);
    return collectXunfeiAudio(socket, payload, Number(env.XUNFEI_TIMEOUT_MS || 15000));
}

function selectVoice(env, requestedVoice) {
    if (requestedVoice === 'EN' && env.XUNFEI_VOICE_EN) {
        return env.XUNFEI_VOICE_EN;
    }

    if (requestedVoice === 'CN' && env.XUNFEI_VOICE_CN) {
        return env.XUNFEI_VOICE_CN;
    }

    return env.XUNFEI_VOICE_CN || DEFAULT_XUNFEI_VOICE;
}

function addReadingPause(text) {
    if (/[。！？.!?]$/.test(text)) {
        return text;
    }

    return `${text}。`;
}

function buildCorsHeaders(env) {
    return new Headers({
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin'
    });
}

function jsonResponse(body, status, headers) {
    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8');

    return new Response(JSON.stringify(body), {
        status,
        headers: responseHeaders
    });
}
