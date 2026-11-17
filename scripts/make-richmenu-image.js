// 依照 config/richmenu.json 自動產生圖文選單圖片 assets/richmenu.png (2500x1686)
// 需要 Playwright：npm i -D playwright && npx playwright install chromium
// 也可以不用這支，直接用 Canva 做一張 2500x1686 的圖，存成 assets/richmenu.png
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config', 'richmenu.json'), 'utf8'));
const colors = ['#06C755', '#FF8A3D', '#3D8BFF', '#8E5CF7', '#FFB800', '#E4572E'];

const cells = cfg.buttons.slice(0, 6).map((b, i) => `
  <div class="cell" style="--c:${colors[i % colors.length]}">
    <div class="icon">${b.icon || ''}</div>
    <div class="label">${b.label}</div>
  </div>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  body{width:2500px;height:1686px;background:#f4f5f7;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:16px;padding:16px;height:100%}
  .cell{background:#fff;border-radius:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;
        border-bottom:24px solid var(--c);box-shadow:0 8px 24px rgba(0,0,0,.08)}
  .icon{font-size:260px;line-height:1.1}
  .label{font-size:130px;font-weight:800;color:#222;margin-top:30px;letter-spacing:6px}
</style></head><body><div class="grid">${cells}</div></body></html>`;

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch {
    console.error('需要 playwright：npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2500, height: 1686 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const out = path.join(root, 'assets', 'richmenu.png');
  await page.screenshot({ path: out, type: 'png' });
  await browser.close();
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`已產生 ${out} (${kb} KB)${kb > 1024 ? '  ⚠️ 超過 1MB，請壓縮或改存 jpg' : ''}`);
})();
