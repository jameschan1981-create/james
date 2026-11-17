// 把 config/cards.json 的設定轉成 LINE Flex Message「多圖卡片」(carousel)
const fs = require('fs');
const path = require('path');

const CARDS_PATH = path.join(__dirname, '..', 'config', 'cards.json');

// 每次讀檔，改完 cards.json 不用重開伺服器
function loadConfig() {
  return JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));
}

function toAction(btn) {
  const label = String(btn.label).slice(0, 20); // LINE 按鈕文字上限 20 字
  switch (btn.type) {
    case 'uri':
      return { type: 'uri', label, uri: btn.value };
    case 'postback':
      return { type: 'postback', label, data: btn.value, displayText: btn.label };
    case 'menu': // 點了直接開另一組卡片
      return { type: 'postback', label, data: `menu=${btn.value}`, displayText: btn.label };
    case 'message':
    default:
      return { type: 'message', label, text: btn.value };
  }
}

function buildBubble(card) {
  const bodyContents = [
    { type: 'text', text: card.title, weight: 'bold', size: 'lg', wrap: true },
  ];
  if (card.description) {
    bodyContents.push({
      type: 'text', text: card.description, size: 'sm', color: '#666666', wrap: true, margin: 'md',
    });
  }
  if (card.price) {
    bodyContents.push({
      type: 'text', text: card.price, size: 'xl', weight: 'bold', color: '#E4572E', margin: 'md',
    });
  }

  const bubble = {
    type: 'bubble',
    size: 'kilo',
    hero: {
      type: 'image',
      url: card.image,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: bodyContents },
  };

  // 點圖片也能觸發第一個按鈕
  const buttons = (card.buttons || []).slice(0, 3);
  if (buttons.length) {
    bubble.hero.action = toAction(buttons[0]);
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: buttons.map((b, i) => ({
        type: 'button',
        style: i === 0 ? 'primary' : 'secondary',
        color: i === 0 ? '#06C755' : undefined,
        height: 'sm',
        action: toAction(b),
      })).map(stripUndefined),
    };
  }
  return bubble;
}

function stripUndefined(obj) {
  Object.keys(obj).forEach((k) => obj[k] === undefined && delete obj[k]);
  return obj;
}

function buildCarousel(menu) {
  return {
    type: 'flex',
    altText: menu.altText || menu.id,
    contents: {
      type: 'carousel',
      contents: menu.cards.slice(0, 12).map(buildBubble),
    },
  };
}

function quickReply(labels) {
  return {
    items: labels.slice(0, 13).map((t) => ({
      type: 'action',
      action: { type: 'message', label: t.slice(0, 20), text: t },
    })),
  };
}

function findMenuById(config, id) {
  return config.menus.find((m) => m.id === id);
}

// 關鍵字比對：訊息「包含」任一關鍵字就命中（不分大小寫）
function findMenuByText(config, text) {
  const t = text.trim().toLowerCase();
  return config.menus.find((m) => (m.keywords || []).some((k) => t.includes(k.toLowerCase())));
}

module.exports = { loadConfig, buildCarousel, quickReply, findMenuById, findMenuByText };
