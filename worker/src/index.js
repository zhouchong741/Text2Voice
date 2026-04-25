const DEFAULT_MODEL = '@cf/myshell-ai/melotts';

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

            if (!text) {
                return jsonResponse({ error: 'Missing text' }, 400, corsHeaders);
            }

            if (text.length > maxTextLength) {
                return jsonResponse({ error: `Text is longer than ${maxTextLength} characters` }, 413, corsHeaders);
            }

            const model = env.TTS_MODEL || DEFAULT_MODEL;
            const audioResponse = await runTextToSpeech(env, model, text, lang);
            const headers = new Headers(audioResponse.headers);
            headers.set('Access-Control-Allow-Origin', corsHeaders.get('Access-Control-Allow-Origin'));
            headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
            headers.set('Access-Control-Allow-Headers', 'Content-Type');
            headers.set('Cache-Control', 'no-store');
            headers.set('Content-Type', headers.get('Content-Type') || getAudioContentType(model));

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

async function runTextToSpeech(env, model, text, lang) {
    if (model === '@cf/deepgram/aura-1') {
        return env.AI.run(model, {
            text,
            speaker: lang === 'en' ? 'luna' : 'stella',
            encoding: 'mp3'
        }, {
            returnRawResponse: true
        });
    }

    const result = await env.AI.run(model, {
        prompt: text,
        lang
    });

    if (result instanceof Response) {
        return result;
    }

    if (result && typeof result.audio === 'string') {
        return new Response(base64ToArrayBuffer(result.audio), {
            headers: {
                'Content-Type': getAudioContentType(model)
            }
        });
    }

    throw new Error('Unexpected Workers AI response');
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
    return lang === 'en' ? 'en' : 'zh';
}

function getAudioContentType(model) {
    return model === '@cf/deepgram/aura-1' ? 'audio/mpeg' : 'audio/wav';
}

function jsonResponse(body, status, headers) {
    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8');

    return new Response(JSON.stringify(body), {
        status,
        headers: responseHeaders
    });
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
}
