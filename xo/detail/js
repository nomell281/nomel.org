// api/detail.js
// 사용법:
//   /api/detail?p=제목|작성자|내용|반응|조회수|공유수&c=댓글작성자|댓글내용|반응~댓글작성자2|댓글내용2|반응2~...
// 구분자: 단어 사이는 "_", 필드 사이는 "|", 댓글 사이는 "~"
// 반응 형식: "좋아요수-싫어요수"  예) 24-3  → 👍24  👎3
//
// 화면 구성:
//   Anonymous Board (좁은 헤더)
//   ------------------
//   제목
//   ------------------
//   프로필  작성자 닉네임          조회수
//   ------------------
//   내용
//   ------------------
//   댓글 갯수  👍👎  🔁(공유수)
//   ------------------
//   프로필 댓글작성자
//   내용
//   👍👎
//   ------------------
//   (댓글마다 반복)

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

function wrap(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function parseReactions(str = "") {
  const [up = "0", down = "0"] = str.split("-");
  return { up: up || "0", down: down || "0" };
}

// 아바타 배경색을 매번 랜덤으로 고름
const AVATAR_PALETTE = [
  "#FF8FB3", "#FFB37A", "#FFD666", "#9BE0A0",
  "#7ED6C1", "#7EC8E3", "#9FA8FF", "#C79BFF",
  "#FF9BD2", "#B8C4D9",
];
function colorForName(_name) {
  return AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
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

// ---- 레이아웃 상수 ----
const PAD = 24;
const HEADER_H = 46; // 좁게

const TITLE_LINE_HEIGHT = 24;
const CONTENT_LINE_HEIGHT = 20;
const COMMENT_LINE_HEIGHT = 19;

const AVATAR_R_POST = 13;
const AVATAR_R_COMMENT = 11;
const TEXT_INDENT_POST = PAD + AVATAR_R_POST * 2 + 8;
const TEXT_INDENT_COMMENT = PAD + AVATAR_R_COMMENT * 2 + 8;

// 구분선 앞뒤 여백
const GAP_TO_DIVIDER = 16;
const GAP_FROM_DIVIDER = 26;

function divider(y, thick) {
  return `<line x1="0" y1="${y}" x2="375" y2="${y}" stroke="${
    thick ? "#E9DCFF" : "#F0E6FF"
  }" stroke-width="${thick ? 4 : 1}"/>`;
}

function renderComment(author, text, reactions, y) {
  const lines = wrap(text, 22);
  const nameY = y;
  const textStartY = nameY + 24;
  const lastLineY = textStartY + (lines.length - 1) * COMMENT_LINE_HEIGHT;
  const reactY = lastLineY + 24;

  const avatar = renderAvatar(
    PAD + AVATAR_R_COMMENT,
    nameY - AVATAR_R_COMMENT + 5,
    AVATAR_R_COMMENT,
    author
  );

  const body = lines
    .map(
      (line, i) =>
        `<text x="${PAD}" y="${textStartY + i * COMMENT_LINE_HEIGHT}" font-size="13" fill="#3D2C4E">${esc(
          line
        )}</text>`
    )
    .join("");

  return {
    bottomY: reactY,
    svg: `
      ${avatar}
      <text x="${TEXT_INDENT_COMMENT}" y="${nameY}" font-size="13" font-weight="700" fill="#3D2C4E">${esc(
      author
    )}</text>
      ${body}
      <text x="${PAD}" y="${reactY}" font-size="12" fill="#8E8E8E">👍 ${esc(reactions.up)}</text>
      <text x="${PAD + 42}" y="${reactY}" font-size="12" fill="#8E8E8E">👎 ${esc(
      reactions.down
    )}</text>
    `,
  };
}

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const [title, author, content, reactionsRaw, views, shares] = (
    url.searchParams.get("p") || ""
  ).split("|");
  const commentsRaw = (url.searchParams.get("c") || "").split("~").filter(Boolean);

  const titleLines = wrap(deslug(title || ""), 16);
  const contentLines = wrap(deslug(content || ""), 20);
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

  // 구분선 1
  let dY = y + GAP_TO_DIVIDER;
  parts.push(divider(dY));
  y = dY + GAP_FROM_DIVIDER;

  // 프로필 + 작성자 닉네임 + 조회수
  const metaY = y;
  parts.push(
    renderAvatar(PAD + AVATAR_R_POST, metaY - AVATAR_R_POST + 5, AVATAR_R_POST, deslug(author || "익명"))
  );
  parts.push(
    `<text x="${TEXT_INDENT_POST}" y="${metaY}" font-size="13" font-weight="700" fill="#3D2C4E">${esc(
      deslug(author || "익명")
    )}</text>`
  );
  parts.push(
    `<text x="351" y="${metaY}" font-size="12" fill="#B79FE0" text-anchor="end">조회 ${esc(
      views || "0"
    )}</text>`
  );
  y = metaY;

  // 구분선 2
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

  // 구분선 3
  dY = y + GAP_TO_DIVIDER;
  parts.push(divider(dY));
  y = dY + GAP_FROM_DIVIDER;

  // 댓글수 / 반응 / 공유수
  const statsY = y;
  parts.push(
    `<text x="${PAD}" y="${statsY}" font-size="12.5" fill="#3D2C4E">💬 ${commentCount}</text>`
  );
  parts.push(
    `<text x="${PAD + 52}" y="${statsY}" font-size="12.5" fill="#3D2C4E">👍 ${esc(reacts.up)}</text>`
  );
  parts.push(
    `<text x="${PAD + 94}" y="${statsY}" font-size="12.5" fill="#3D2C4E">👎 ${esc(reacts.down)}</text>`
  );
  parts.push(
    `<text x="351" y="${statsY}" font-size="12.5" fill="#B79FE0" text-anchor="end">🔁 ${esc(
      shares || "0"
    )}</text>`
  );
  y = statsY;

  // 구분선 4 (댓글 시작 전, 조금 더 두껍게)
  dY = y + GAP_TO_DIVIDER;
  parts.push(divider(dY, true));
  y = dY + GAP_FROM_DIVIDER;

  // 댓글 목록 (댓글마다 끝에 구분선)
  commentsRaw.forEach((c) => {
    const [ca, ctext, creact] = c.split("|");
    const { bottomY, svg } = renderComment(
      deslug(ca || "익명"),
      deslug(ctext || ""),
      parseReactions(creact || ""),
      y
    );
    parts.push(svg);
    y = bottomY;

    dY = y + GAP_TO_DIVIDER;
    parts.push(divider(dY));
    y = dY + GAP_FROM_DIVIDER;
  });

  const totalHeight = y - GAP_FROM_DIVIDER + 20;

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
