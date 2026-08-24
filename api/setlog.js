// api/setlog.js
// 셋로그 SVG를 요청 시점 데이터로 동적 생성. (list.js/detail.js와 동일한 구분자 컨벤션 사용)
//
// GET /api/setlog?g=football&d=6월 12일 (금)&p=테오|18:00|훈련 마무리~카를로스|18:00|헬멧 벗는 중
//   g: 그룹 키 (cheer/football/basketball/dance/band)
//   d: 스토리상 날짜
//   p: "이름|시간|내용" 을 ~ 로 이어붙인 목록. 여기 없는 로스터 멤버는 자동 "대기중"

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 그룹별 고정 로스터 ──────────────────────────────
// 각 그룹: 주요 멤버(스토리에 등장하는 캐릭터) + 나머지는 미리 이름 지어둔 고정 인원.
// 인원 구성 자체는 여기서 바뀌지 않음 — 매 호출마다 time/content/posted만 덮어씀.
const GROUPS = {
  cheer: {
    title: '🎀 로지스',
    roster: [
      { name: '아스트리아', initial: '아', color: '#3AA0A5' },
      { name: '에밀리', initial: '에', color: '#6B5AA0' },
      { name: '알렉스', initial: '알', color: '#C08A3E' },
      { name: '미아', initial: '미', color: '#A54A3A' },
      { name: '요코', initial: '요', color: '#4A8F5F' },
      { name: '스칼렛', initial: '스', color: '#B0567A' },
      { name: '주디', initial: '주', color: '#3A6EA5' },
      { name: '시드니', initial: '시', color: '#8A6D3A' }
    ]
  },
  football: {
    title: '🏈 울브스',
    roster: [
      { name: '데릭', initial: '데', color: '#4A8F5F' },
      { name: '서준', initial: '서', color: '#3A6EA5' },
      { name: '테오', initial: '테', color: '#A54A3A' },
      { name: '리암', initial: '리', color: '#6B5AA0' },
      { name: '윌리엄', initial: '윌', color: '#C08A3E' },
      { name: '이안', initial: '이', color: '#3AA0A5' },
      { name: '카이', initial: '카', color: '#B0567A' },
      { name: '알렉스', initial: '알', color: '#8A6D3A' }
    ]
  },
  basketball: {
    title: '🏀 블랙 호크스',
    roster: [
      { name: '카를로스', initial: '카', color: '#A54A3A' },
      { name: '존', initial: '존', color: '#3A6EA5' },
      { name: '로빈', initial: '로', color: '#6B5AA0' },
      { name: '리드넬', initial: '리', color: '#C08A3E' },
      { name: '에릭', initial: '에', color: '#4A8F5F' },
      { name: '조나단', initial: '조', color: '#3AA0A5' },
      { name: '레오', initial: '레', color: '#B0567A' },
      { name: '제이슨', initial: '제', color: '#8A6D3A' }
    ]
  },
  dance: {
    title: '💃 이클립스',
    roster: [
      { name: '다니엘', initial: '다', color: '#4A8F5F' },
      { name: '미카엘', initial: '미', color: '#3A6EA5' },
      { name: '루카스', initial: '루', color: '#A54A3A' },
      { name: '리아', initial: '리', color: '#6B5AA0' },
      { name: '소피아', initial: '소', color: '#3AA0A5' }
    ]
  },
  band: {
    title: '🎸 이그니스',
    roster: [
      { name: '에반', initial: '에', color: '#4A8F5F' },
      { name: '제일런', initial: '제', color: '#3A6EA5' }
    ]
  }
};

// ── 레이아웃 계산 ──────────────────────────────
// 1~5인: 1열 세로 배치 (358x150), 6~8인: 2열 그리드(173x110), 홀수 마지막 줄은 중앙 정렬
function computeLayout(count) {
  const positions = [];

  if (count <= 5) {
    const cellW = 358, cellH = 150, gap = 16, startY = 104;
    for (let i = 0; i < count; i++) {
      positions.push({ x: 16, y: startY + i * (cellH + gap), w: cellW, h: cellH, size: 'large' });
    }
    return { positions, contentBottom: startY + count * (cellH + gap) };
  }

  const colW = 173, rowH = 110, colGap = 12, rowGap = 12, startY = 104;
  const colX = [16, 16 + colW + colGap];
  const rows = Math.ceil(count / 2);
  const lastRowCount = count - (rows - 1) * 2;

  for (let r = 0; r < rows; r++) {
    const isLastRow = r === rows - 1;
    const colsInRow = isLastRow ? lastRowCount : 2;
    const y = startY + r * (rowH + rowGap);

    if (colsInRow === 1) {
      const centeredX = (colX[0] + colX[1]) / 2;
      positions.push({ x: centeredX, y, w: colW, h: rowH, size: 'small' });
    } else {
      for (let c = 0; c < colsInRow; c++) {
        positions.push({ x: colX[c], y, w: colW, h: rowH, size: 'small' });
      }
    }
  }
  return { positions, contentBottom: startY + rows * (rowH + rowGap) };
}

function renderCell(pos, member) {
  const { x, y, w, h, size } = pos;
  const cx = x + w / 2;
  const isLarge = size === 'large';

  const timeFontSize = isLarge ? 27 : 17;
  const contentFontSize = isLarge ? 11 : 8;
  const nameFontSize = isLarge ? 13 : 10;
  const avatarR = isLarge ? 16 : 10;
  const avatarX = x + (isLarge ? 26 : 18);
  const avatarY = y + h - (isLarge ? 22 : 18);

  if (!member.posted) {
    return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#FFFFFF" stroke="#CDE7F7" stroke-width="1.5" stroke-dasharray="5 5"/>
      <text x="${cx}" y="${y + h * 0.42}" font-family="Helvetica, Arial, sans-serif" font-size="${isLarge ? 21 : 14}" font-weight="800" fill="#D5E4EC" text-anchor="middle">대기중</text>
      <text x="${cx}" y="${y + h * 0.42 + (isLarge ? 22 : 16)}" font-family="Helvetica, Arial, sans-serif" font-size="${isLarge ? 11 : 8}" fill="#C4D6E0" text-anchor="middle">아직 업로드 전</text>
      <circle cx="${avatarX}" cy="${avatarY}" r="${avatarR}" fill="#EAF3F8"/>
      <text x="${avatarX}" y="${avatarY + 3}" font-family="Helvetica, Arial, sans-serif" font-size="${isLarge ? 12 : 9}" font-weight="700" fill="#9FADBA" text-anchor="middle">${esc(member.initial)}</text>
      <text x="${avatarX + avatarR + 8}" y="${avatarY + 3}" font-family="Helvetica, Arial, sans-serif" font-size="${nameFontSize}" font-weight="700" fill="#9FADBA">${esc(member.name)}</text>
    </g>`;
  }

  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#FFFFFF"/>
      <text x="${cx}" y="${y + h * 0.42}" font-family="Helvetica, Arial, sans-serif" font-size="${timeFontSize}" font-weight="800" fill="#3A2E33" text-anchor="middle">${esc(member.time)}</text>
      <text x="${cx}" y="${y + h * 0.42 + (isLarge ? 22 : 16)}" font-family="Helvetica, Arial, sans-serif" font-size="${contentFontSize}" fill="#9FADBA" text-anchor="middle">${esc(member.content)}</text>
      <circle cx="${avatarX}" cy="${avatarY}" r="${avatarR}" fill="${esc(member.color)}"/>
      <text x="${avatarX}" y="${avatarY + 3}" font-family="Helvetica, Arial, sans-serif" font-size="${isLarge ? 12 : 9}" font-weight="700" fill="#FFFFFF" text-anchor="middle">${esc(member.initial)}</text>
      <text x="${avatarX + avatarR + 8}" y="${avatarY + 3}" font-family="Helvetica, Arial, sans-serif" font-size="${nameFontSize}" font-weight="700" fill="#3A2E33">${esc(member.name)}</text>
    </g>`;
}

function renderProgress(cx, cy, posted, total) {
  const hearts = [];
  for (let i = 0; i < total; i++) {
    const filled = i < posted;
    const hx = cx - (total - 1) * 7.5 + i * 15;
    hearts.push(
      `<text x="${hx}" y="${cy}" font-family="Helvetica, Arial, sans-serif" font-size="13" text-anchor="middle"${filled ? '' : ' opacity="0.3"'}>${filled ? '💗' : '🤍'}</text>`
    );
  }
  return hearts.join('');
}

function buildSvg({ title, date, members }) {
  const count = Math.min(members.length, 8);
  const { positions, contentBottom } = computeLayout(count);
  const postedCount = members.slice(0, count).filter(m => m.posted).length;

  const innerHeight = contentBottom + 60;
  const outerHeight = innerHeight + 40;
  const outerWidth = 470;

  const cellsSvg = positions.map((pos, i) => renderCell(pos, members[i])).join('');

  return `<svg width="${outerWidth}" height="${outerHeight}" viewBox="0 0 ${outerWidth} ${outerHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${outerWidth}" height="${outerHeight}" fill="#EAF6FF"/>
  <g fill="#FFD54F">
    <path d="M22 50 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z"/>
  </g>
  <g fill="#FF8FA3">
    <path d="M448 100 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z"/>
  </g>
  <g transform="translate(40, 20)">
    <rect width="390" height="${innerHeight}" rx="8" fill="#D6EFFF"/>
    <rect x="16" y="20" width="358" height="68" rx="18" fill="#FFFFFF"/>
    <text x="205" y="48" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="800" fill="#3A2E33" text-anchor="middle">${esc(title)}</text>
    <text x="205" y="70" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="500" fill="#8FA6B8" text-anchor="middle">${esc(date)}</text>
    ${cellsSvg}
    ${renderProgress(195, contentBottom + 30, postedCount, count)}
    <text x="195" y="${contentBottom + 54}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="600" fill="#8FA6B8" text-anchor="middle">오늘 ${postedCount}/${count} 완료</text>
  </g>
</svg>`;
}

// g 파라미터 축약 코드 (list.js/detail.js 스타일에 맞춘 짧은 키)
const GROUP_ALIASES = {
  cheer: 'cheer', football: 'football', basketball: 'basketball',
  dance: 'dance', band: 'band'
};

// p 파라미터 파싱: "이름|시간|내용~이름2|시간2|내용2" 형식
// (detail.js의 c= 댓글 파라미터와 동일한 구분자 컨벤션: ~ 로 레코드 구분, | 로 필드 구분)
function parsePosted(pStr) {
  if (!pStr) return {};
  const result = {};
  pStr.split('~').forEach(record => {
    const [name, time, content] = record.split('|');
    if (name) {
      result[name] = { time: time || '', content: content || '', posted: true };
    }
  });
  return result;
}
// 그룹 로스터 + overrides(이름별 time/content/posted)를 합쳐 members 배열 생성
function buildGroupMembers(groupKey, overrides) {
  const group = GROUPS[groupKey];
  if (!group) return null;

  const members = group.roster.map(m => {
    const ov = overrides[m.name] || {};
    return {
      name: m.name,
      initial: m.initial,
      color: m.color,
      time: ov.time || '',
      content: ov.content || '',
      posted: ov.posted === true
    };
  });

  return { title: group.title, members };
}

module.exports = async (req, res) => {
  try {
    const q = req.query;
    const group = q.g || q.group;
    const date = q.d || q.date;
    const title = q.t || q.title;
    const members = q.members;

    if (!date) {
      res.status(400).send('d(date) 파라미터가 필요합니다.');
      return;
    }

    let finalTitle, finalMembers;

    if (group) {
      // p: "이름|시간|내용~이름2|시간2|내용2" 형식 (list.js/detail.js와 동일 구분자 컨벤션)
      const parsedOverrides = parsePosted(q.p);
      const built = buildGroupMembers(group, parsedOverrides);
      if (!built) {
        res.status(400).send(`알 수 없는 g입니다. (사용 가능: ${Object.keys(GROUPS).join(', ')})`);
        return;
      }
      finalTitle = title || built.title;
      finalMembers = built.members;
    } else {
      if (!title || !members) {
        res.status(400).send('g 파라미터가 없으면 t, members가 필요합니다.');
        return;
      }
      try {
        finalMembers = JSON.parse(members);
      } catch (e) {
        res.status(400).send('members는 유효한 JSON 배열이어야 합니다.');
        return;
      }
      finalTitle = title;
    }

    if (!Array.isArray(finalMembers) || finalMembers.length === 0) {
      res.status(400).send('인원은 최소 1명 이상이어야 합니다.');
      return;
    }
    if (finalMembers.length > 8) {
      finalMembers = finalMembers.slice(0, 8);
    }

    const svg = buildSvg({ title: finalTitle, date, members: finalMembers });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(svg);
  } catch (err) {
    res.status(500).send('셋로그 생성 중 오류가 발생했습니다.');
  }
};
