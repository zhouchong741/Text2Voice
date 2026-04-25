import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
    buildXunfeiAuthUrl,
    buildXunfeiPayload,
    rateToXunfeiSpeed
} from '../src/xunfei.js';

const fixedDate = 'Thu, 01 Aug 2019 01:53:21 GMT';
const apiKey = 'test-api-key';
const apiSecret = 'test-api-secret';

const authUrl = await buildXunfeiAuthUrl({ apiKey, apiSecret, date: fixedDate });
const parsedUrl = new URL(authUrl);
assert.equal(parsedUrl.protocol, 'wss:');
assert.equal(parsedUrl.host, 'tts-api.xfyun.cn');
assert.equal(parsedUrl.pathname, '/v2/tts');
assert.equal(parsedUrl.searchParams.get('host'), 'tts-api.xfyun.cn');
assert.equal(parsedUrl.searchParams.get('date'), fixedDate);

const expectedSignature = createHmac('sha256', apiSecret)
    .update(`host: tts-api.xfyun.cn\ndate: ${fixedDate}\nGET /v2/tts HTTP/1.1`)
    .digest('base64');
const authorization = Buffer.from(parsedUrl.searchParams.get('authorization'), 'base64').toString('utf8');
assert.equal(
    authorization,
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${expectedSignature}"`
);

const payload = buildXunfeiPayload({
    appId: 'app-id',
    text: '苹果',
    voice: 'x4_xiaoyan',
    speed: 55
});

assert.equal(payload.common.app_id, 'app-id');
assert.equal(payload.business.aue, 'lame');
assert.equal(payload.business.sfl, 1);
assert.equal(payload.business.tte, 'UTF8');
assert.equal(payload.business.vcn, 'x4_xiaoyan');
assert.equal(payload.business.speed, 55);
assert.equal(Buffer.from(payload.data.text, 'base64').toString('utf8'), '苹果');
assert.equal(payload.data.status, 2);

assert.equal(rateToXunfeiSpeed(0.5), 25);
assert.equal(rateToXunfeiSpeed(1), 50);
assert.equal(rateToXunfeiSpeed(2), 100);

console.log('xunfei tests passed');
