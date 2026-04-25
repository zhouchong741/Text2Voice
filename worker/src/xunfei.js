const XUNFEI_HOST = 'tts-api.xfyun.cn';
const XUNFEI_PATH = '/v2/tts';
const XUNFEI_URL = `wss://${XUNFEI_HOST}${XUNFEI_PATH}`;

export async function buildXunfeiAuthUrl({ apiKey, apiSecret, date = new Date().toUTCString() }) {
    const signatureOrigin = `host: ${XUNFEI_HOST}\ndate: ${date}\nGET ${XUNFEI_PATH} HTTP/1.1`;
    const signature = await hmacSha256Base64(apiSecret, signatureOrigin);
    const authorizationOrigin = [
        `api_key="${apiKey}"`,
        'algorithm="hmac-sha256"',
        'headers="host date request-line"',
        `signature="${signature}"`
    ].join(', ');
    const params = new URLSearchParams({
        authorization: base64EncodeUtf8(authorizationOrigin),
        date,
        host: XUNFEI_HOST
    });

    return `${XUNFEI_URL}?${params.toString()}`;
}

export function buildXunfeiPayload({ appId, text, voice, speed }) {
    return {
        common: {
            app_id: appId
        },
        business: {
            aue: 'lame',
            sfl: 1,
            auf: 'audio/L16;rate=16000',
            vcn: voice,
            speed,
            volume: 60,
            pitch: 50,
            bgs: 0,
            tte: 'UTF8',
            reg: '0',
            rdn: '0'
        },
        data: {
            status: 2,
            text: base64EncodeUtf8(text)
        }
    };
}

export function rateToXunfeiSpeed(rate) {
    const numericRate = Number(rate);
    const safeRate = Number.isFinite(numericRate) ? numericRate : 1;
    return Math.round(Math.min(Math.max(safeRate, 0.5), 2) * 50);
}

export function collectXunfeiAudio(socket, payload, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let settled = false;
        const timeoutId = setTimeout(() => {
            fail(new Error('Xunfei TTS timed out'));
        }, timeoutMs);

        function finish() {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(concatUint8Arrays(chunks));
        }

        function fail(error) {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        }

        function cleanup() {
            clearTimeout(timeoutId);
            try {
                if (socket.readyState === 1) {
                    socket.close(1000, 'done');
                }
            } catch (_) {
                // Ignore close errors after the remote side has already closed.
            }
        }

        socket.addEventListener('open', () => {
            socket.send(JSON.stringify(payload));
        });

        socket.addEventListener('message', (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.code !== 0) {
                    fail(new Error(`Xunfei TTS failed: ${message.code} ${message.message || ''}`.trim()));
                    return;
                }

                if (message.data?.audio) {
                    chunks.push(base64ToUint8Array(message.data.audio));
                }

                if (message.data?.status === 2) {
                    finish();
                }
            } catch (error) {
                fail(error);
            }
        });

        socket.addEventListener('error', () => {
            fail(new Error('Xunfei WebSocket error'));
        });

        socket.addEventListener('close', (event) => {
            if (!settled) {
                fail(new Error(`Xunfei WebSocket closed before completion: ${event.code}`));
            }
        });
    });
}

async function hmacSha256Base64(secret, message) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return base64EncodeBytes(new Uint8Array(signature));
}

function base64EncodeUtf8(value) {
    return base64EncodeBytes(new TextEncoder().encode(String(value)));
}

function base64EncodeBytes(bytes) {
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    if (typeof btoa === 'function') {
        return btoa(binary);
    }

    return Buffer.from(binary, 'binary').toString('base64');
}

function base64ToUint8Array(value) {
    let binary;
    if (typeof atob === 'function') {
        binary = atob(value);
    } else {
        binary = Buffer.from(value, 'base64').toString('binary');
    }

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function concatUint8Arrays(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;

    chunks.forEach((chunk) => {
        output.set(chunk, offset);
        offset += chunk.length;
    });

    return output;
}
