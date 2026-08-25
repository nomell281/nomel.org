// api/feed.js
// 사용법:
//   /api/feed?a=아이디&t=시간&cap=캡션&tags=태그1~태그2&lk=좋아요수&img=이미지설명&friends=친구1~친구2~친구3&c=댓글작성자|댓글내용|좋아요수~...
// 구분자: 단어 사이는 "_", friends/c/tags 내 항목 사이는 "~", 댓글 필드는 "|"(작성자|내용|좋아요수, 좋아요수 생략 가능)
// tags는 "#" 없이 단어만 넘기면 자동으로 붙여서 하늘색으로 표시
// c는 최대 4개까지만 렌더링(그 이상은 "더 보기" 문구로 갈음). cm(총 댓글수)은 생략 시 c 개수로 자동 계산
//
// 화면 구성:
//   XOXO 헤더 (하트/DM 아이콘)
//   스토리 트레이 (내 스토리 + friends 여러 명)
//   ------------------
//   프로필 · 아이디 · 시간
//   ------------------
//   사진 영역 (4:5, 회색 배경 + 이미지 설명 텍스트)
//   ------------------
//   하트 / 댓글 / 공유 / 북마크
//   좋아요 N개
//   아이디 캡션 · 해시태그
//   댓글 목록(최대 4개, 아바타+아이디+댓글 한 줄 정렬)
//   시간
//   댓글 작성란

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

function wrap(text, fontSize, maxWidthPx, firstLineReduction = 0) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  let curWidth = 0;
  const spaceWidth = fontSize * 0.224;

  for (const w of words) {
    const wWidth = textWidth(w, fontSize);
    const limit = lines.length === 0 ? maxWidthPx - firstLineReduction : maxWidthPx;
    const nextWidth = cur ? curWidth + spaceWidth + wWidth : wWidth;
    if (cur && nextWidth > limit) {
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

module.exports = (req, res) => {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams;

  const author = deslug(q.get("a") || "익명");
  const time = deslug(q.get("t") || "방금 전");
  const caption = deslug(q.get("cap") || "");
  const tags = (q.get("tags") || "").split("~").filter(Boolean).map((t) => deslug(t).replace(/^#/, ""));
  const likes = parseInt(q.get("lk") || "0", 10) || 0;
  const img = deslug(q.get("img") || "");
  const friends = (q.get("friends") || "").split("~").filter(Boolean).map(deslug);
  const rawComments = (q.get("c") || "").split("~").filter(Boolean);
  const commentList = rawComments.slice(0, 4).map((c) => {
    const [ca, ctext, clikes] = c.split("|");
    return { author: deslug(ca || "익명"), text: deslug(ctext || ""), likes: parseInt(clikes || "0", 10) || 0 };
  });
  const comments = q.get("cm") ? parseInt(q.get("cm"), 10) || 0 : rawComments.length;

  const imgLines = wrap(img, 13, 320);
  const capLines = wrap(caption, 12.5, 300);
  const RIGHT_RESERVE = 46; // 댓글 우측 하트+좋아요수 자리
  const commentLinesList = commentList.map((c) => {
    const prefixWidth = textWidth(c.author, 12) * 1.05 + textWidth("  ", 12); // 볼드체 여유 5%
    return wrap(c.text, 12, 290 - RIGHT_RESERVE, prefixWidth);
  });

  const HEADER_H = 46;
  const TRAY_H = 100;
  const POST_HEADER_H = 60;
  const PHOTO_H = 469;

  const parts = [];

  // 상단 앱바
  parts.push(`
    <text x="16" y="34" font-size="22" font-weight="700" fill="#111111" font-family="'Segoe Script','Brush Script MT',cursive">XOXO</text>
    <g transform="translate(300,14)">
      <path d="M10 20 L4 14 C1 11 1 7 4 5 C7 3 10 5 10 8 C10 5 13 3 16 5 C19 7 19 11 16 14 Z" fill="none" stroke="#111111" stroke-width="1.6"/>
      <path d="M30 6 L44 6 L44 18 L36 18 L32 22 L32 18 L30 18 Z" fill="none" stroke="#111111" stroke-width="1.6" stroke-linejoin="round"/>
    </g>
    <line x1="0" y1="46" x2="375" y2="46" stroke="#efefef" stroke-width="1"/>
  `);

  // 스토리 트레이
  const storyList = friends.length ? friends : [author];
  const storyItemsSvg = storyList
    .map((name, i) => `
      <g transform="translate(${96 + i * 80},0)">
        <circle cx="30" cy="30" r="29" fill="none" stroke="url(#storyRing)" stroke-width="2.5"/>
        ${renderAvatar(30, 30, 26, name)}
        <text x="30" y="72" font-size="10.5" fill="#111111" text-anchor="middle">${esc(name)}</text>
      </g>
    `)
    .join("");
  parts.push(`
    <g transform="translate(0,54)">
      <rect width="375" height="${TRAY_H}" fill="#ffffff"/>
      <g transform="translate(16,8)">
        <circle cx="30" cy="30" r="28" fill="#fafafa" stroke="#dddddd" stroke-width="1.5"/>
        <text x="30" y="34" font-size="11" fill="#888888" text-anchor="middle">내 스토리</text>
      </g>
      ${storyItemsSvg}
    </g>
    <defs>
      <linearGradient id="storyRing" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#feda75"/>
        <stop offset="50%" stop-color="#d62976"/>
        <stop offset="100%" stop-color="#4f5bd5"/>
      </linearGradient>
    </defs>
    <line x1="0" y1="${54 + TRAY_H}" x2="375" y2="${54 + TRAY_H}" stroke="#efefef" stroke-width="1"/>
  `);

  // 게시물 헤더
  const headerY = 54 + TRAY_H + 14;
  parts.push(`
    <g transform="translate(0,${headerY})">
      ${renderAvatar(30, 24, 17, author)}
      <text x="54" y="21" font-size="13.5" font-weight="600" fill="#111111">${esc(author)}</text>
      <text x="54" y="35" font-size="11" fill="#8e8e8e">${esc(time)}</text>
      <text x="345" y="28" font-size="18" fill="#111111" text-anchor="middle">⋯</text>
    </g>
  `);

  // 사진 영역
  const photoY = headerY + POST_HEADER_H;
  const imgTextStartY = 200 + (3 - imgLines.length) * 11;
  const imgTextSvg = imgLines
    .map((line, i) => `<text x="187.5" y="${imgTextStartY + i * 22}" font-size="13" fill="#555555" text-anchor="middle">${esc(line)}</text>`)
    .join("");
  parts.push(`
    <g transform="translate(0,${photoY})">
      <rect x="0" y="0" width="375" height="${PHOTO_H}" fill="#f2f2f2"/>
      <text x="187.5" y="176" font-size="11" fill="#aaaaaa" text-anchor="middle">[이미지 설명]</text>
      ${imgTextSvg}
    </g>
  `);

  // 액션 아이콘
  const actionsY = photoY + PHOTO_H + 14;
  parts.push(`
    <g transform="translate(16,${actionsY})" fill="none" stroke="#111111" stroke-linecap="round" stroke-linejoin="round">
      <g transform="translate(0,2)" stroke-width="1.7">
        <path d="M12,21 C12,21 3,14.8 3,8.9 C3,5.9 5.4,3.8 8,3.8 C9.9,3.8 11.1,4.9 12,6.4 C12.9,4.9 14.1,3.8 16,3.8 C18.6,3.8 21,5.9 21,8.9 C21,14.8 12,21 12,21 Z"/>
      </g>
      <g transform="translate(34,3)" stroke-width="1.7">
        <path d="M2,12 C2,6.48 6.48,2 12,2 C17.52,2 22,6.48 22,12 C22,17.52 17.52,22 12,22 C10.4,22 8.89,21.62 7.55,20.94 L2,22 L3.4,17.1 C2.52,15.6 2,13.86 2,12 Z"/>
      </g>
      <g transform="translate(70,3)" stroke-width="1.6">
        <path d="M22,2 L2,10.2 L10.4,13.6 L13.8,22 Z"/>
        <path d="M22,2 L10.4,13.6"/>
      </g>
      <g transform="translate(330,2)" stroke-width="1.7">
        <path d="M6,3 L18,3 L18,21 L12,16.5 L6,21 Z"/>
      </g>
    </g>
  `);

  // 좋아요/캡션/댓글
  const metaY = actionsY + 44;
  const capSvg = capLines
    .map((line, i) =>
      i === 0
        ? `<text x="16" y="${metaY + 20}" font-size="12.5" fill="#111111"><tspan font-weight="600">${esc(author)}</tspan>  ${esc(line)}</text>`
        : `<text x="16" y="${metaY + 20 + i * 18}" font-size="12.5" fill="#111111">${esc(line)}</text>`
    )
    .join("");
  const afterCapY = metaY + 20 + (capLines.length - 1) * 18;

  const tagsY = tags.length ? afterCapY + 20 : afterCapY;
  const tagsSvg = tags.length
    ? `<text x="16" y="${tagsY}" font-size="12" fill="#5AC8FA">${tags.map((t) => "#" + esc(t)).join("  ")}</text>`
    : "";

  const dividerY = tagsY + (tags.length ? 14 : 14);
  const dividerSvg = commentList.length
    ? `<line x1="16" y1="${dividerY}" x2="359" y2="${dividerY}" stroke="#f2f2f2" stroke-width="1"/>`
    : "";

  let cY = dividerY + (commentList.length ? 22 : 6);
  const moreCount = comments - commentList.length;
  const moreLine = moreCount > 0 ? `<text x="16" y="${cY}" font-size="11.5" fill="#8e8e8e">댓글 ${moreCount}개 더 보기</text>` : "";
  if (moreCount > 0) cY += 22;

  // 댓글: 프로필 + 아이디 + 내용을 한 줄에 나란히(평행) 배치, 우측에 좋아요(하트+수)
  const commentsSvg = commentList
    .map((c, idx) => {
      const lines = commentLinesList[idx];
      const rowTop = cY;
      const av = renderAvatar(24, rowTop + 6, 11, c.author);
      const firstLine = `<text x="42" y="${rowTop + 10}" font-size="12" fill="#666666"><tspan font-weight="600" fill="#111111">${esc(c.author)}</tspan>  ${esc(lines[0] || "")}</text>`;
      const restLines = lines
        .slice(1)
        .map((l, li) => `<text x="42" y="${rowTop + 10 + (li + 1) * 16}" font-size="12" fill="#666666">${esc(l)}</text>`)
        .join("");
      const heartSvg = `
        <g transform="translate(345,${rowTop - 2})">
          <path d="M6,12 C6,12 1,8.5 1,5 C1,3 2.5,1.6 4.5,1.6 C5.6,1.6 6.4,2.2 6,3 C6.4,2.2 7.4,1.6 8.5,1.6 C10.5,1.6 12,3 12,5 C12,8.5 6,12 6,12 Z" fill="none" stroke="#8e8e8e" stroke-width="1.2"/>
          <text x="6" y="24" font-size="9.5" fill="#8e8e8e" text-anchor="middle">${c.likes}</text>
        </g>
      `;
      cY = rowTop + 16 + (lines.length - 1) * 16 + 18;
      return av + firstLine + restLines + heartSvg;
    })
    .join("");
  const afterCommentsY = cY;

  const timestampY = afterCommentsY + 14;

  // 댓글 작성란
  const inputBarY = timestampY + 22;
  const inputBarSvg = `
    <line x1="0" y1="${inputBarY}" x2="375" y2="${inputBarY}" stroke="#efefef" stroke-width="1"/>
    <g transform="translate(0,${inputBarY})">
      ${renderAvatar(28, 30, 15, author)}
      <rect x="52" y="12" width="255" height="36" rx="18" fill="#f7f7f7" stroke="#efefef" stroke-width="1"/>
      <text x="66" y="34" font-size="12" fill="#9a9a9a">댓글 달기...</text>
      <text x="340" y="34" font-size="12" font-weight="600" fill="#5AC8FA">게시</text>
    </g>
  `;
  const INPUT_BAR_H = 60;
  const totalHeight = inputBarY + INPUT_BAR_H;

  parts.push(`
    <text x="16" y="${metaY}" font-size="12.5" font-weight="600" fill="#111111">좋아요 ${likes}개</text>
    ${caption ? capSvg : ""}
    ${tagsSvg}
    ${dividerSvg}
    ${moreLine}
    ${commentsSvg}
    <text x="16" y="${timestampY}" font-size="11" fill="#c2c2c2">${esc(time)}</text>
    ${inputBarSvg}
  `);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="375" height="${totalHeight}" viewBox="0 0 375 ${totalHeight}" font-family="-apple-system, 'Apple SD Gothic Neo', sans-serif">
    <rect width="375" height="${totalHeight}" fill="#ffffff"/>
    ${parts.join("")}
  </svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(svg);
};
