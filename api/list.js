// api/list.js
// 사용법: /api/list?t=gossip&p=제목|작성자|시간|조회수&p=제목2|작성자2|...
// 구분자: 단어 사이는 "_", 필드 사이는 "|", 여러 게시물은 "p" 파라미터를 반복 (최대 6개)
// 조회수가 50 이상이면 자동으로 🔥 인기글 표시가 붙음 (반응/좋아요는 목록에 없음)

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

function charWidth(ch, fontSize) {
  return /[\u3131-\uD79D\u3000-\u303F\uFF00-\uFFEF]/.test(ch) ? fontSize : fontSize * 0.55;
}

function wrap(text, fontSize, maxWidthPx, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  let curWidth = 0;
  const spaceWidth = fontSize * 0.3;

  for (const w of words) {
    let wWidth = 0;
    for (const ch of w) wWidth += charWidth(ch, fontSize);
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
  return maxLines ? lines.slice(0, maxLines) : lines;
}

// 닉네임 기반 해시로 아바타 배경색을 고름 (같은 닉네임은 항상 같은 색)
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

const POPULAR_VIEWS_THRESHOLD = 50;

function parsePost(raw) {
  const [title, author, time, views] = raw.split("|");
  return {
    title: deslug(title || ""),
    author: deslug(author || "익명"),
    time: deslug(time || ""),
    views: parseInt(views || "0", 10) || 0,
  };
}

const PAD = 16;
const TITLE_TOP_OFFSET = 30;
const TITLE_LINE_HEIGHT = 22;
const GAP_TITLE_TO_META = 24;
const CARD_BOTTOM_PADDING = 18;
const AVATAR_R = 12;

function renderPostCard(post, y) {
  const isHot = post.views >= POPULAR_VIEWS_THRESHOLD;
  const titleLines = wrap(post.title, 15, 343 - PAD * 2 - (isHot ? 26 : 0), 2);

  const lastTitleOffset = TITLE_TOP_OFFSET + (titleLines.length - 1) * TITLE_LINE_HEIGHT;
  const metaOffset = lastTitleOffset + GAP_TITLE_TO_META;
  const cardHeight = metaOffset + CARD_BOTTOM_PADDING;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="${PAD + 16}" y="${
          y + TITLE_TOP_OFFSET + i * TITLE_LINE_HEIGHT
        }" font-size="15" font-weight="700" fill="#3D2C4E">${esc(line)}</text>`
    )
    .join("");

  const hotBadge = isHot
    ? `<text x="343" y="${y + TITLE_TOP_OFFSET}" font-size="15" text-anchor="end">🔥</text>`
    : "";

  const avatar = renderAvatar(PAD + 16 + AVATAR_R, y + metaOffset - AVATAR_R + 4, AVATAR_R, post.author);
  const metaTextX = PAD + 16 + AVATAR_R * 2 + 8;

  const svg = `
    <rect x="${PAD}" y="${y}" width="${359 - PAD}" height="${cardHeight}" rx="18" fill="#FFFFFF" stroke="#F0E6FF" stroke-width="1.5"/>
    ${titleSvg}
    ${hotBadge}
    ${avatar}
    <text x="${metaTextX}" y="${y + metaOffset}" font-size="11" fill="#B79FE0">${esc(
    post.author
  )} · ${esc(post.time)}</text>
  `;
  return { svg, height: cardHeight };
}

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const rawPosts = url.searchParams.getAll("p");
  const posts = rawPosts.slice(0, 6).map(parsePost); // 항상 최대 6개 고정

  let y = 96;
  const cards = [];
  for (const post of posts) {
    const { svg, height } = renderPostCard(post, y);
    cards.push(svg);
    y += height + 14;
  }
  const totalHeight = y + 20;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 ${totalHeight}" width="375" height="${totalHeight}" font-family="-apple-system,'Apple SD Gothic Neo',sans-serif">
    <defs>
      <linearGradient id="hd" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#B18CFF"/>
        <stop offset="100%" stop-color="#FF6FA5"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="375" height="${totalHeight}" fill="#FAF7FF"/>
    <rect x="0" y="0" width="375" height="70" fill="url(#hd)"/>
    <text x="24" y="44" font-size="18" font-weight="800" fill="#FFFFFF">🎭 Anonymous Board</text>
    ${cards.join("")}
  </svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(svg);
};
