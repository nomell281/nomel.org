// api/dm.js
// 사용법:
//   /api/dm?a=상대방아이디&st=상태&m=발신자|내용~발신자2|내용2~...&typing=1
// 구분자: 단어 사이는 "_", 발신자|내용 사이는 "|", 메시지 사이는 "~"
// 발신자: "me"면 파란 말풍선(오른쪽 정렬), 그 외 문자열이면 회색 말풍선(왼쪽 정렬 + 아바타)
// 내용이 "IMG:"로 시작하면 사진 첨부처럼 회색 카드 + 이미지 설명으로 렌더링
//   예) m=theo_k|야_오늘_연습_안_왔던데~me|아_잠깐_몸이_안_좋았어~theo_k|IMG:체육관_앞에서_걱정스러운_표정으로_셀카
// typing=1 이면 마지막에 상대방 타이핑 표시(...) 추가

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deslug(s = "") {
  return decodeURIComponent(s).replace(/_/g, " ");
}

// 실측 폰트(Noto Sans CJK KR, 12.5px 기준) 보정 계수
function charWidth(ch, fontSize) {
  if (ch === " ") return fontSize * 0.224;
  if (/[\u3131-\uD79D\u3000-\u303F\uFF00-\uFFEF]/.test(ch)) return fontSize * 0.92;
  return fontSize * 0.472;
}

function textWidth(s, fontSize) {
  let w = 0;
  for (const ch of s) w += charWidth(ch, fontSize);
  return w;
}

function wrap(text, fontSize, maxWidthPx) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  let curWidth = 0;
  const spaceWidth = fontSize * 0.224;

  for (const w of words) {
    const wWidth = textWidth(w, fontSize);
    const nextWidth = cur ? curWidth + spaceWidth + wWidth : wWidth;
    if (cur && nextWidth > maxWidthPx) {
      lines.push(cur);
      cur = w;
      curWidth = wWidth;
    } else {
      cur = cur ? cur + " " + w : w;
      curWidth = nextWidth;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const AVATAR_PALETTE = [
  "#FF8FB3", "#FFB37A", "#FFD666", "#9BE0A0",
  "#7ED6C1", "#7EC8E3", "#9FA8FF", "#C79BFF",
  "#FF9BD2", "#B8C4D9",
];
function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

let avatarIdCounter = 0;
function renderAvatar(cx, cy, r, name) {
  const id = `av${avatarIdCounter++}`;
  const color = colorForName(name);
  return `
    <clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <g clip-path="url(#${id})">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
      <circle cx="${cx}" cy="${cy - r * 0.28}" r="${r * 0.4}" fill="#FFFFFF"/>
      <circle cx="${cx}" cy="${cy + r * 0.95}" r="${r * 0.85}" fill="#FFFFFF"/>
    </g>
  `;
}

const BUBBLE_MAX_WIDTH = 250; // 말풍선 최대 너비(줄바꿈 기준)
const PAD = 16; // 말풍선 좌우 패딩(각 방향)
const LINE_H = 20;
const BUBBLE_MIN_H = 34;
const ROW_GAP = 12;
const AVATAR_R = 14;
const RIGHT_EDGE = 359;
const LEFT_TEXT_X = 64;

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;

  const author = deslug(q.get("a") || "익명");
  const status = deslug(q.get("st") || "활동 중");
  const rawMsgs = (q.get("m") || "").split("~").filter(Boolean);
  const showTyping = q.get("typing") === "1";

  const parts = [];
  let y = 0;

  rawMsgs.forEach((raw) => {
    const [senderRaw, ...rest] = raw.split("|");
    const sender = deslug(senderRaw || "");
    const isMe = sender === "me" || senderRaw === "me";
    let content = deslug(rest.join("|") || "");

    if (content.startsWith("IMG:")) {
      const desc = content.slice(4);
      const lines = wrap(desc, 11, 130);
      const cardH = 60 + lines.length * 16;
      const cardW = 150;
      const cardX = isMe ? RIGHT_EDGE - cardW : 48;
      if (!isMe) parts.push(renderAvatar(26, y + AVATAR_R, AVATAR_R, sender));
      parts.push(`
        <rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="14" fill="${isMe ? "#cfe6ff" : "#e5e5e5"}"/>
        <text x="${cardX + cardW / 2}" y="${y + 24}" font-size="10" fill="#999999" text-anchor="middle">[이미지 설명]</text>
        ${lines.map((l, i) => `<text x="${cardX + cardW / 2}" y="${y + 44 + i * 16}" font-size="11" fill="#555555" text-anchor="middle">${esc(l)}</text>`).join("")}
      `);
      y += cardH + ROW_GAP;
      return;
    }

    const lines = wrap(content, 12.5, BUBBLE_MAX_WIDTH - PAD * 2);
    const textW = Math.max(...lines.map((l) => textWidth(l, 12.5)));
    const bubbleW = Math.min(BUBBLE_MAX_WIDTH, textW + PAD * 2);
    const bubbleH = Math.max(BUBBLE_MIN_H, lines.length * LINE_H + 14);
    const bubbleX = isMe ? RIGHT_EDGE - bubbleW : 48;
    const textX = isMe ? RIGHT_EDGE - PAD : LEFT_TEXT_X;
    const firstLineY = y + (lines.length === 1 ? 21 : 18);

    if (!isMe) parts.push(renderAvatar(26, y + AVATAR_R, AVATAR_R, sender));
    parts.push(`
      <rect x="${bubbleX}" y="${y}" width="${bubbleW}" height="${bubbleH}" rx="17" fill="${isMe ? "#3897f0" : "#efefef"}"/>
      ${lines
        .map(
          (l, i) =>
            `<text x="${textX}" y="${firstLineY + i * LINE_H}" font-size="12.5" fill="${isMe ? "#ffffff" : "#111111"}" text-anchor="${isMe ? "end" : "start"}">${esc(l)}</text>`
        )
        .join("")}
    `);
    y += bubbleH + ROW_GAP;
  });

  if (showTyping) {
    parts.push(renderAvatar(26, y + AVATAR_R, AVATAR_R, author));
    parts.push(`
      <rect x="48" y="${y}" width="60" height="30" rx="15" fill="#efefef"/>
      <circle cx="66" cy="${y + 15}" r="3" fill="#9a9a9a"/>
      <circle cx="78" cy="${y + 15}" r="3" fill="#9a9a9a"/>
      <circle cx="90" cy="${y + 15}" r="3" fill="#9a9a9a"/>
    `);
    y += 30 + ROW_GAP;
  }

  const chatHeight = y + 20;
  const inputY = chatHeight + 70;
  const totalHeight = inputY + 66;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="375" height="${totalHeight}" viewBox="0 0 375 ${totalHeight}" font-family="-apple-system, 'Apple SD Gothic Neo', sans-serif">
    <rect width="375" height="${totalHeight}" fill="#ffffff"/>

    <g transform="translate(0,0)">
      <text x="16" y="30" font-size="20" fill="#111111">←</text>
      ${renderAvatar(66, 24, 16, author)}
      <text x="90" y="21" font-size="13.5" font-weight="600" fill="#111111">${esc(author)}</text>
      <text x="90" y="35" font-size="10.5" fill="#8e8e8e">${esc(status)}</text>
      <text x="325" y="18" font-size="15" fill="#111111">📞</text>
      <text x="352" y="18" font-size="15" fill="#111111">ⓘ</text>
    </g>
    <line x1="0" y1="46" x2="375" y2="46" stroke="#efefef" stroke-width="1"/>

    <g transform="translate(0,64)">
      ${parts.join("")}
    </g>

    <g transform="translate(0,${inputY})">
      <line x1="0" y1="0" x2="375" y2="0" stroke="#efefef" stroke-width="1"/>
      <circle cx="28" cy="30" r="14" fill="none" stroke="#111111" stroke-width="1.5"/>
      <text x="28" y="34" font-size="14" fill="#111111" text-anchor="middle">＋</text>
      <rect x="52" y="12" width="250" height="36" rx="18" fill="#f2f2f2"/>
      <text x="68" y="34" font-size="12" fill="#9a9a9a">메시지 보내기...</text>
      <text x="320" y="34" font-size="16" fill="#111111">❤</text>
    </g>
  </svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(svg);
};
