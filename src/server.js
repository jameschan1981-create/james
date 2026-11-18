// LINE Webhook 伺服器：客人點圖文選單 / 打關鍵字 → 自動回覆多圖卡片
const http = require('http');
const fs = require('fs');
const path = require('path');
const { reply, verifySignature } = require('./line');
const { loadConfig, buildCarousel, quickReply, findMenuById, findMenuByText } = require('./flex');

// 讀取 .env（不需 dotenv 套件）
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function messagesFor(event) {
  const config = loadConfig();

  // 1. 新加好友 → 歡迎詞 + 一組卡片
  if (event.type === 'follow') {
    const msgs = [{ type: 'text', text: config.welcome.text }];
    const menu = findMenuById(config, config.welcome.showMenu);
    if (menu) msgs.push(buildCarousel(menu));
    return msgs;
  }

  // 2. 點圖文選單 / 卡片按鈕 (postback: menu=xxx)
  if (event.type === 'postback') {
    const id = new URLSearchParams(event.postback.data).get('menu');
    const menu = id && findMenuById(config, id);
    if (menu) return [buildCarousel(menu)];
  }

  // 3. 客人打字 → 比對關鍵字
  if (event.type === 'message' && event.message.type === 'text') {
    // 詢價/下單 → 不出卡片，交給真人
    const t = event.message.text;
    if (config.handoff && config.handoff.keywords.some((k) => t.includes(k))) {
      return [{ type: 'text', text: config.handoff.text }];
    }
    const menu = findMenuByText(config, event.message.text);
    if (menu) return [buildCarousel(menu)];
    return [{
      type: 'text',
      text: config.fallback.text,
      quickReply: quickReply(config.fallback.quickReplies || []),
    }];
  }

  return [];
}

async function handleEvent(event) {
  if (!event.replyToken) return;
  const messages = messagesFor(event);
  if (messages.length) await reply(event.replyToken, messages.slice(0, 5));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('LINE card bot is running ✅');
  }

  // 預覽：/preview/products → 回傳 Flex JSON，可貼到 Flex Message Simulator 看效果
  if (req.method === 'GET' && url.pathname.startsWith('/preview/')) {
    const menu = findMenuById(loadConfig(), url.pathname.split('/')[2]);
    res.writeHead(menu ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(menu ? buildCarousel(menu).contents : { error: 'not found' }, null, 2));
  }

  if (req.method === 'POST' && url.pathname === '/webhook') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks);
      if (!verifySignature(raw, req.headers['x-line-signature'])) {
        res.writeHead(401);
        return res.end('bad signature');
      }
      res.writeHead(200);
      res.end('ok'); // 先回 200，LINE 才不會重送
      let body;
      try { body = JSON.parse(raw.toString('utf8')); } catch { return; }
      for (const ev of body.events || []) {
        try { await handleEvent(ev); } catch (err) { console.error('處理事件失敗:', err.message); }
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`LINE bot 啟動於 http://localhost:${port}  (webhook: /webhook)`));
}

module.exports = { server, messagesFor };
