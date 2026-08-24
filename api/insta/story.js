// api/insta/story.js
// 사용법:
// /api/story?a=아이디&t=시간&img=이미지설명&say=말풍선텍스트
// 구분자: 단어 사이는 "_"
// img: 카테고리 뱃지 없이, "ㅇㅇ의 셀카" / "ㅇㅇ이 오늘 일상을 찍어 올림" 처럼
//      상황 자체를 문장으로 담아서 넣는다 (별도 cat 파라미터 없음)
// say는 선택 사항(인용구처럼 하단에 표시), 없으면 생략

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

function renderAvatar(cx, cy, r, name) {
  const color = colorForName(name);
  return `
    <clipPath id="avS"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <g clip-path="url(#avS)">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
      <circle cx="${cx}" cy="${cy - r * 0.28}" r="${r * 0.4}" fill="#FFFFFF"/>
      <circle cx="${cx}" cy="${cy + r * 0.95}" r="${r * 0.85}" fill="#FFFFFF"/>
    </g>
  `;
}

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;

  const author = deslug(q.get("a") || "익명");
  const time = deslug(q.get("t") || "방금 전");
  const img = deslug(q.get("img") || "");
  const say = deslug(q.get("say") || "");

  const imgLines = wrap(img, 13, 260);
  const sayLines = say ? wrap(`"${say}"`, 13, 260) : [];
  const bgColor = colorForName(author + "_bg");

  // 위에서 아래로 순서대로 배치 (겹침 방지) — 뱃지 없이 이미지 설명부터 바로 시작
  let cursorY = 260;
  const labelY = cursorY;
  cursorY += 30;
  const imgStartY = cursorY;
  cursorY += imgLines.length * 22 + 24;
  const sayStartY = cursorY;

  const imgSvg = imgLines
    .map((line, i) => `<text x="187.5" y="${imgStartY + i * 22}" font-size="13" fill="#ffffff" text-anchor="middle">${esc(line)}</text>`)
    .join("");

  const saySvg = sayLines
    .map((line, i) => `<text x="187.5" y="${sayStartY + i * 20}" font-size="13" fill="#e0e0e0" text-anchor="middle">${esc(line)}</text>`)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="375" height="740" viewBox="0 0 375 740" font-family="-apple-system, 'Apple SD Gothic Neo', sans-serif">
    <rect x="0" y="0" width="375" height="740" fill="#3a3a3a"/>
    <g transform="translate(10,10)">
      <rect x="0" y="0" width="355" height="2.5" rx="1.25" fill="#ffffff"/>
    </g>
    <g transform="translate(14,20)">
      ${renderAvatar(18, 18, 16, author)}
      <text x="42" y="16" font-size="13.5" font-weight="600" fill="#ffffff">${esc(author)}</text>
      <text x="42" y="30" font-size="11" fill="#d9d9d9">${esc(time)}</text>
    </g>
    <text x="345" y="42" font-size="20" fill="#ffffff" text-anchor="middle">✕</text>
    <text x="187.5" y="${labelY}" font-size="11" fill="#c9c9c9" text-anchor="middle">[이미지 설명]</text>
    ${imgSvg}
    ${saySvg}
    <g transform="translate(16,690)">
      <rect x="0" y="0" width="270" height="40" rx="20" fill="none" stroke="#ffffff" stroke-width="1.2"/>
      <text x="18" y="25" font-size="12" fill="#c9c9c9">메시지 보내기</text>
      <g transform="translate(290,4)">
        <path d="M8 22 L1 15 C-2 12 -2 7 1 4 C4 1 8 3 8 7 C8 3 12 1 15 4 C18 7 18 12 15 15 Z" fill="none" stroke="#ffffff" stroke-width="1.6"/>
      </g>
      <g transform="translate(322,6)">
        <path d="M0 0 L16 0 L16 24 L8 16 L0 24 Z" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
      </g>
    </g>
  </svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(svg);
};
