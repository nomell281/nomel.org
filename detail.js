// api/detail.js
// 사용법:
//   /api/detail?p=제목|작성자|시간|내용&c=댓글작성자|댓글내용~댓글작성자2|댓글내용2~...
// 구분자: 단어 사이는 "_", 필드 사이는 "|", 댓글 사이는 "~"
// (반응/좋아요는 없음)
//
// 화면 구성:
//   Anonymous Board (좁은 헤더)
//   ------------------
//   제목
//   ------------------
//   작성자 · 시간
//   ------------------
//   내용
//   ==================  (굵은 구분선)
//   댓글 갯수
//   작성자
//   댓글
//   작성자
//   댓글
//   (댓글에는 반응 없음)

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

// ---- 레이아웃 상수 ----
const PAD = 24;
const HEADER_H = 46;

const TITLE_LINE_HEIGHT = 24;
const CONTENT_LINE_HEIGHT = 20;
const COMMENT_LINE_HEIGHT = 19;

const GAP_TO_DIVIDER = 14;
const GAP_FROM_DIVIDER = 24;
const GAP_BETWEEN_COMMENTS = 22;

function divider(y, thick) {
  return `<line x1="0" y1="${y}" x2="375" y2="${y}" stroke="${
    thick ? "#D9C6FF" : "#F0E6FF"
  }" stroke-width="${thick ? 5 : 1}"/>`;
}

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const [title, author, time, content] = (url.searchParams.get("p") || "").split("|");
  const commentsRaw = (url.searchParams.get("c") || "").split("~").filter(Boolean);

  const titleLines = wrap(deslug(title || ""), 17, 327);
  const contentLines = wrap(deslug(content || ""), 13.5, 327);
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

  // 작성자 · 시간
  parts.push(
    `<text x="${PAD}" y="${y}" font-size="11.5" fill="#B79FE0">${esc(
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

  // 굵은 구분선 (댓글 영역 시작 전)
  dY = y + GAP_TO_DIVIDER + 6;
  parts.push(divider(dY, true));
  y = dY + GAP_FROM_DIVIDER;

  // 댓글 갯수
  parts.push(
    `<text x="${PAD}" y="${y}" font-size="12.5" font-weight="700" fill="#8A6FC9">댓글 ${commentCount}개</text>`
  );
  y += GAP_BETWEEN_COMMENTS;

  // 댓글 목록 (반응 없음)
  commentsRaw.forEach((c) => {
    const [ca, ctext] = c.split("|");
    const author2 = deslug(ca || "익명");
    const lines = wrap(deslug(ctext || ""), 13, 327);

    parts.push(
      `<text x="${PAD}" y="${y}" font-size="13" font-weight="700" fill="#3D2C4E">${esc(
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
