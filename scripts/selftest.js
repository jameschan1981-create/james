// 本機自我測試：模擬 LINE 送來的事件，檢查會不會回出正確卡片（不會真的打 LINE API）
process.env.DRY_RUN = '1';
const assert = require('assert');
const { messagesFor } = require('../src/server');
const { loadConfig } = require('../src/flex');

const config = loadConfig();
const text = (t) => ({ type: 'message', replyToken: 'x', message: { type: 'text', text: t } });

// 每組卡片都能用關鍵字 & 圖文選單按鈕叫出來
for (const menu of config.menus) {
  const [m] = messagesFor(text(menu.keywords[0]));
  assert.strictEqual(m.type, 'flex', `關鍵字「${menu.keywords[0]}」沒有回卡片`);
  assert.strictEqual(m.contents.contents.length, Math.min(menu.cards.length, 12));
  const [p] = messagesFor({ type: 'postback', replyToken: 'x', postback: { data: `menu=${menu.id}` } });
  assert.strictEqual(p.altText, menu.altText);
  for (const card of menu.cards) {
    assert(/^https:\/\//.test(card.image), `${menu.id}「${card.title}」圖片必須是 https`);
    assert((card.buttons || []).length <= 3, `${menu.id}「${card.title}」按鈕最多 3 個`);
  }
}

// 圖文選單的每個按鈕都對應到存在的卡片組
const rich = require('../config/richmenu.json');
for (const b of rich.buttons) {
  if (b.menu) assert(config.menus.some((m) => m.id === b.menu), `圖文選單「${b.label}」找不到 menu: ${b.menu}`);
}

// 詢價 → 交給真人（純文字，不出卡片）
for (const t of ['我想詢問紙箱報價', '詹哥你好，我想詢問報價：']) {
  const r = messagesFor(text(t));
  assert.strictEqual(r.length, 1); assert.strictEqual(r[0].type, 'text', `「${t}」應該交給真人`);
}

// 卡片上的 message 按鈕不能造成無限循環（按了又回同一組卡片）
for (const menu of config.menus) for (const card of menu.cards) for (const b of card.buttons || []) {
  if (b.type !== 'message') continue;
  const [r] = messagesFor(text(b.value));
  assert(!(r.type === 'flex' && r.altText === menu.altText), `「${b.label}」按了又回到同一組卡片`);
}

// 聽不懂 → 預設回覆 + 快速按鈕
const [fb] = messagesFor(text('asdfgh'));
assert.strictEqual(fb.type, 'text');
assert(fb.quickReply.items.length > 0);

// 新好友 → 歡迎詞 + 卡片
const welcome = messagesFor({ type: 'follow', replyToken: 'x' });
assert.strictEqual(welcome[0].type, 'text');
assert.strictEqual(welcome[1].type, 'flex');

console.log(`✅ 全部通過：${config.menus.length} 組卡片、${rich.buttons.length} 個選單按鈕`);
