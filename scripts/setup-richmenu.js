// 建立圖文選單並設為所有好友的預設選單
// 用法：npm run richmenu            （建立新的並設為預設，會刪掉舊的）
//       npm run richmenu -- --keep  （保留舊的選單）
const fs = require('fs');
const path = require('path');
require('../src/server'); // 載入 .env
const { API, API_DATA, call } = require('../src/line');

const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config', 'richmenu.json'), 'utf8'));
const imgPath = ['richmenu.png', 'richmenu.jpg']
  .map((f) => path.join(root, 'assets', f))
  .find((p) => fs.existsSync(p));

const W = 2500, H = 1686, COLS = 3, ROWS = 2;

function areas() {
  return cfg.buttons.slice(0, 6).map((b, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = Math.round((W / COLS) * col), y = Math.round((H / ROWS) * row);
    const width = Math.round((W / COLS) * (col + 1)) - x;
    const height = Math.round((H / ROWS) * (row + 1)) - y;
    const action = b.url
      ? { type: 'uri', label: b.label, uri: b.url }
      : { type: 'postback', label: b.label, data: `menu=${b.menu}`, displayText: b.label };
    return { bounds: { x, y, width, height }, action };
  });
}

(async () => {
  if (!imgPath) throw new Error('找不到 assets/richmenu.png，請先執行 npm run richmenu:image 或放入自己的圖 (2500x1686)');
  if (fs.statSync(imgPath).size > 1024 * 1024) throw new Error('圖文選單圖片必須小於 1MB');

  if (!process.argv.includes('--keep')) {
    const { richmenus = [] } = await call(`${API}/richmenu/list`, { method: 'GET' });
    for (const m of richmenus) {
      await call(`${API}/richmenu/${m.richMenuId}`, { method: 'DELETE' });
      console.log('已刪除舊選單', m.richMenuId);
    }
  }

  const { richMenuId } = await call(`${API}/richmenu`, {
    body: {
      size: { width: W, height: H },
      selected: true, // 預設展開
      name: cfg.name,
      chatBarText: cfg.chatBarText.slice(0, 14),
      areas: areas(),
    },
  });
  console.log('建立選單', richMenuId);

  await call(`${API_DATA}/richmenu/${richMenuId}/content`, {
    body: fs.readFileSync(imgPath),
    headers: { 'Content-Type': imgPath.endsWith('.png') ? 'image/png' : 'image/jpeg' },
  });
  console.log('上傳圖片完成');

  await call(`${API}/user/all/richmenu/${richMenuId}`, {});
  console.log('✅ 已設為預設圖文選單！打開 LINE 聊天室就看得到（可能要重新進入聊天室）');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
