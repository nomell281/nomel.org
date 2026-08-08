// api/detail.js
// 사용법:
//   /api/detail?p=제목|작성자|시간|내용|반응&c=댓글작성자|댓글내용|반응~댓글작성자2|댓글내용2|반응2~...
// 구분자: 단어 사이는 "_", 필드 사이는 "|", 댓글 사이는 "~"
// 반응 형식: "이모지+숫자"를 "-"로 연결, 최대 5개, 매번 다른 이모지 조합 가능
//   예) 🔥12-💀5-😱3-🤣8-🥰2
//
// 화면 구성:
//   Anonymous Board (좁은 헤더)
//   ------------------
//   제목
//   ------------------
//   프로필 작성자 · 시간
//   ------------------
//   내용
//   🔥💀😱🤣 반응
//   ==================  (굵은 구분선)
//   댓글 갯수
//   프로필 작성자
//   댓글
//   🔥💀😱🤣 반응
//   프로필 작성자
//   댓글
//   🔥💀😱🤣 반응

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

function wrap(text, fontSize, maxWidthPx) {
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
  return lines;
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

function parseReactions(str = "") {
  if (!str) return [];
  return str
    .split("-")
    .map((r) => {
      const m = r.match(/^(\D+)(\d+)$/u);
      if (!m) return null;
      return { emoji: m[1], count: m[2] };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function reactionsRow(x, y, items) {
  let cx = x;
  const pillH = 24;
  const pillY = y - pillH + 6;
  const parts = items.map((it) => {
    const digits = String(it.count).length;
    const w = 36 + Math.max(0, digits - 1) * 8;
    const svg = `
      <rect x="${cx}" y="${pillY}" width="${w}" height="${pillH}" rx="12" fill="#F5EFFF"/>
      <text x="${cx + w / 2}" y="${y}" font-size="12.5" text-anchor="middle" fill="#3D2C4E">${
      it.emoji
    } ${it.count}</text>
    `;
    cx += w + 8;
    return svg;
  });
  return parts.join("");
}

// ---- 레이아웃 상수 ----
const PAD = 24;
const HEADER_H = 46;

const TITLE_LINE_HEIGHT = 24;
const CONTENT_LINE_HEIGHT = 20;
const COMMENT_LINE_HEIGHT = 19;

const GAP_TO_DIVIDER = 14;
const GAP_FROM_DIVIDER = 24;
const GAP_BETWEEN_COMMENTS = 40;

function divider(y, thick) {
  return `<line x1="0" y1="${y}" x2="375" y2="${y}" stroke="${
    thick ? "#D9C6FF" : "#F0E6FF"
  }" stroke-width="${thick ? 5 : 1}"/>`;
}

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const [title, author, time, content, reactionsRaw] = (url.searchParams.get("p") || "").split(
    "|"
  );
  const commentsRaw = (url.searchParams.get("c") || "").split("~").filter(Boolean);

  const titleLines = wrap(deslug(title || ""), 17, 327);
  const contentLines = wrap(deslug(content || ""), 13.5, 327);
  const reacts = parseReactions(reactionsRaw || "");
  const commentCount = commentsRaw.length;

  const parts = [];
  let y;

  // 제목
  y = HEADER_H + 34;
  parts.push(
    titleLines
      .map(
        (line, i) =>
          `<text x="${PAD}" y="${y + i * TITLE_LINE_HEIGHT}" font-size="17" font-weight="800" fill="#3D2C4E">${esc(
            line
          )}</text>`
      )
      .join("")
  );
  y = y + (titleLines.length - 1) * TITLE_LINE_HEIGHT;

  // 구분선
  let dY = y + GAP_TO_DIVIDER;
  parts.push(divider(dY));
  y = dY + GAP_FROM_DIVIDER;

  // 작성자 · 시간 (프로필 사진 포함)
  const AVATAR_R_POST = 12;
  parts.push(
    renderAvatar(PAD + AVATAR_R_POST, y - AVATAR_R_POST + 4, AVATAR_R_POST, deslug(author || "익명"))
  );
  parts.push(
    `<text x="${PAD + AVATAR_R_POST * 2 + 8}" y="${y}" font-size="11.5" fill="#B79FE0">${esc(
      deslug(author || "익명")
    )} · ${esc(deslug(time || ""))}</text>`
  );

  // 구분선
  dY = y + GAP_TO_DIVIDER;
  parts.push(divider(dY));
  y = dY + GAP_FROM_DIVIDER;

  // 내용
  const contentStartY = y;
  parts.push(
    contentLines
      .map(
        (line, i) =>
          `<text x="${PAD}" y="${contentStartY + i * CONTENT_LINE_HEIGHT}" font-size="13.5" fill="#3D2C4E">${esc(
            line
          )}</text>`
      )
      .join("")
  );
  y = contentStartY + (contentLines.length - 1) * CONTENT_LINE_HEIGHT;

  // 반응
  y += 42;
  parts.push(reactionsRow(PAD, y, reacts));

  // 굵은 구분선 (댓글 영역 시작 전)
  dY = y + GAP_TO_DIVIDER + 6;
  parts.push(divider(dY, true));
  y = dY + GAP_FROM_DIVIDER;

  // 댓글 갯수
  parts.push(
    `<text x="${PAD}" y="${y}" font-size="12.5" font-weight="700" fill="#8A6FC9">댓글 ${commentCount}개</text>`
  );
  y += GAP_BETWEEN_COMMENTS;

  // 댓글 목록 (프로필 사진 + 반응 포함)
  const AVATAR_R_COMMENT = 11;
  commentsRaw.forEach((c) => {
    const [ca, ctext, creact] = c.split("|");
    const author2 = deslug(ca || "익명");
    const lines = wrap(deslug(ctext || ""), 13, 327 - (AVATAR_R_COMMENT * 2 + 8));
    const cReacts = parseReactions(creact || "");

    parts.push(
      renderAvatar(PAD + AVATAR_R_COMMENT, y - AVATAR_R_COMMENT + 4, AVATAR_R_COMMENT, author2)
    );
    parts.push(
      `<text x="${PAD + AVATAR_R_COMMENT * 2 + 8}" y="${y}" font-size="13" font-weight="700" fill="#3D2C4E">${esc(
        author2
      )}</text>`
    );
    y += 20;
    parts.push(
      lines
        .map(
          (line, i) =>
            `<text x="${PAD}" y="${y + i * COMMENT_LINE_HEIGHT}" font-size="13" fill="#3D2C4E">${esc(
              line
            )}</text>`
        )
        .join("")
    );
    y += (lines.length - 1) * COMMENT_LINE_HEIGHT;
    y += 22;
    parts.push(reactionsRow(PAD, y, cReacts));
    y += GAP_BETWEEN_COMMENTS;
  });

  const totalHeight = y + 12;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 ${totalHeight}" width="375" height="${totalHeight}" font-family="-apple-system,'Apple SD Gothic Neo',sans-serif">
    <defs>
      <linearGradient id="hd" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#B18CFF"/>
        <stop offset="100%" stop-color="#FF6FA5"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="375" height="${totalHeight}" fill="#FFFFFF"/>
    <rect x="0" y="0" width="375" height="${HEADER_H}" fill="url(#hd)"/>
    <text x="${PAD}" y="${HEADER_H / 2 + 6}" font-size="15" font-weight="800" fill="#FFFFFF">🎭 Anonymous Board</text>

    ${parts.join("")}
  </svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(svg);
};
