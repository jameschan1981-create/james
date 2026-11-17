// LINE Messaging API 的精簡呼叫（不用額外安裝套件，Node 18+ 內建 fetch）
const crypto = require('crypto');

const API = 'https://api.line.me/v2/bot';
const API_DATA = 'https://api-data.line.me/v2/bot';

function token() {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error('缺少 LINE_CHANNEL_ACCESS_TOKEN');
  return t;
}

function verifySignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function call(url, { method = 'POST', body, headers = {} } = {}) {
  const isJson = body !== undefined && !Buffer.isBuffer(body);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: isJson ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LINE API ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function reply(replyToken, messages) {
  if (process.env.DRY_RUN) {
    console.log('[DRY_RUN] reply →', JSON.stringify(messages, null, 2));
    return;
  }
  return call(`${API}/message/reply`, { body: { replyToken, messages } });
}

module.exports = { API, API_DATA, call, reply, verifySignature };
