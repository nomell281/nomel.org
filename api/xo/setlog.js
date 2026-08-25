// api/setlog.js
// 셋로그 SVG를 요청 시점 데이터로 동적 생성. (list.js/detail.js와 동일한 구분자 컨벤션 사용)
//
// GET /api/setlog?g=football&d=6월 12일 (금)&p=테오|18:00|훈련 마무리~서준|18:00|헬멧 벗는 중
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

// 문자 하나의 대략적 너비 (한글은 넓게, 공백은 좁게)
function charWidth(ch, fontSize) {
  if (ch === ' ') return fontSize * 0.28;
  if (/[\u3131-\uD79D\u3000-\u303F\uFF00-\uFFEF]/.test(ch)) return fontSize * 1.0;
  return fontSize * 0.55;
}
function textWidth(s, fontSize) {
  let w = 0;
  for (const ch of s) w += charWidth(ch, fontSize);
  return w;
}

// 셀 폭에 맞춰 최대 maxLines줄로 자동 줄바꿈, 넘치면 마지막 줄에 말줄임표
function wrapContent(text, fontSize, maxWidthPx, maxLines) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  let idx = 0;

  while (idx < words.length && lines.length < maxLines) {
    const w = words[idx];
    const trial = cur ? cur + ' ' + w : w;
    if (cur && textWidth(trial, fontSize) > maxWidthPx) {
      lines.push(cur);
      cur = ''; // w는 아직 소비 안 됨 — 다음 줄에서 다시 시도
    } else {
      cur = trial;
      idx++;
    }
  }

  const hasMore = idx < words.length || (lines.length === maxLines && cur);
  if (lines.length < maxLines) {
    lines.push(cur);
  } else if (cur) {
    // 마지막 줄에 남은 단어까지 넣다 넘치면 잘라서 말줄임표
    let last = cur;
    while (textWidth(last + '…', fontSize) > maxWidthPx && last.length > 1) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + '…';
  }

  return lines;
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
      { name: '제시카', initial: '제', color: '#C08A3E' },
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
      { name: '케일럽', initial: '케', color: '#8A6D3A' }
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
    const cellW = 358, cellH = 150, gap = 16, startY = 132;
    for (let i = 0; i < count; i++) {
      positions.push({ x: 16, y: startY + i * (cellH + gap), w: cellW, h: cellH, size: 'large' });
    }
    return { positions, contentBottom: startY + count * (cellH + gap) };
  }

  const colW = 173, rowH = 110, colGap = 12, rowGap = 12, startY = 132;
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
      ${wrapContent(member.content, contentFontSize, w - (isLarge ? 32 : 16), isLarge ? 3 : 2)
        .map((line, i) => `<text x="${cx}" y="${y + h * 0.42 + (isLarge ? 20 : 14) + i * (isLarge ? 13 : 9)}" font-family="Helvetica, Arial, sans-serif" font-size="${contentFontSize}" fill="#9FADBA" text-anchor="middle">${esc(line)}</text>`)
        .join('')}
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

// 시간 타임라인 점: 고정 23개가 아니라 "현재 시각만큼만" 표시 (8시=8개, 9시=9개)
// 새 날짜 요청이 오면 hour가 그 날짜 기준으로 다시 계산되므로 자연히 리셋됨
function renderTimelineDots(cx, cy, hour) {
  const total = hour === null ? 1 : Math.min(Math.max(hour, 1), 23);
  const gap = 12.5;
  const r = 4;
  const startX = cx - ((total - 1) * gap) / 2;

  const dots = [];
  for (let i = 0; i < total; i++) {
    const x = startX + i * gap;
    const isCurrent = i === total - 1; // 마지막(=현재 시각) 점만 진하게+강조
    const fill = isCurrent ? '#FF8A50' : '#FFD9C2'; // 지나간 시간은 흐리게
    dots.push(`<circle cx="${x}" cy="${cy}" r="${r}" fill="${fill}"/>`);
    if (isCurrent) {
      dots.push(`<circle cx="${x}" cy="${cy}" r="${r + 3}" fill="none" stroke="#3A2E33" stroke-width="1.6"/>`);
    }
  }
  return dots.join('');
}

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// "6월_12일_금" 같은 date 문자열에서 월/일을 뽑아 "FEB. 07" 형식으로 변환
// 패턴이 안 맞으면 원본 date를 그대로 반환
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).match(/(\d{1,2})월[_\s]?(\d{1,2})일/);
  if (!m) return dateStr;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (month < 1 || month > 12) return dateStr;
  return `${MONTH_ABBR[month - 1]}. ${String(day).padStart(2, '0')}`;
}

// 채팅 말풍선 아이콘 (원형 박스 안에 배치될 기준 좌표: 박스 중심 x,y) — 작은 사이즈
function renderChatIcon(cx, cy) {
  const x = cx - 7, y = cy - 6;
  return `
    <path d="M${x} ${y} h12 a2.4 2.4 0 0 1 2.4 2.4 v6 a2.4 2.4 0 0 1 -2.4 2.4 h-6 l-3 3 v-3 h-3 a2.4 2.4 0 0 1 -2.4 -2.4 v-6 a2.4 2.4 0 0 1 2.4 -2.4 z"
      fill="none" stroke="#8FA6B8" stroke-width="1.4" stroke-linejoin="round"/>
  `;
}

// 뒤로가기 화살표 아이콘 (원형 박스 중심 기준)
function renderBackArrow(cx, cy) {
  return `<path d="M${cx + 3} ${cy - 4.8} L${cx - 3} ${cy} L${cx + 3} ${cy + 4.8}" fill="none" stroke="#3A2E33" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function buildSvg({ title, date, members, hour }) {
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
    <circle cx="36" cy="54" r="20" fill="#FFFFFF"/>
    ${renderBackArrow(36, 54)}
    <rect x="62" y="34" width="70" height="40" rx="20" fill="#FFFFFF"/>
    <text x="97" y="58" font-family="Helvetica, Arial, sans-serif" font-size="10" font-weight="700" fill="#8FA6B8" text-anchor="middle" letter-spacing="0.5">${esc(formatShortDate(date))}</text>
    <rect x="138" y="34" width="190" height="40" rx="20" fill="#FFFFFF"/>
    <text x="233" y="58" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="800" fill="#3A2E33" text-anchor="middle">${esc(title)}</text>
    <circle cx="354" cy="54" r="20" fill="#FFFFFF"/>
    ${renderChatIcon(354, 54)}
    ${renderTimelineDots(195, 104, hour)}
    ${cellsSvg}
    ${renderProgress(195, contentBottom + 30, postedCount, count)}
    <text x="195" y="${contentBottom + 54}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="600" fill="#8FA6B8" text-anchor="middle">오늘 ${postedCount}/${count} 완료</text>
  </g>
</svg>`;
}

// g 파라미터 축약 코드 + 한글 팀명도 그대로 인식 (AI가 영문 키 대신 팀명을 쓰는 경우 대비)
const GROUP_ALIASES = {
  cheer: 'cheer', football: 'football', basketball: 'basketball',
  dance: 'dance', band: 'band',
  '로지스': 'cheer', '울브스': 'football', '블랙호크스': 'basketball',
  '이클립스': 'dance', '이그니스': 'band'
};

// p 파라미터 파싱: "이름|시간|내용~이름2|시간2|내용2" 형식
// (detail.js의 c= 댓글 파라미터와 동일한 구분자 컨벤션: ~ 로 레코드 구분, | 로 필드 구분)
// 밑줄(_)을 공백으로 되돌림 (list.js/detail.js와 동일한 "공백→_" 컨벤션 복원)
function deslug(s) {
  return String(s || '').replace(/_/g, ' ');
}

// p 파라미터 파싱: "이름|시간|내용~이름2|시간2|내용2" 형식
// (detail.js의 c= 댓글 파라미터와 동일한 구분자 컨벤션: ~ 로 레코드 구분, | 로 필드 구분)
function parsePosted(pStr) {
  if (!pStr) return {};
  const result = {};
  pStr.split('~').forEach(record => {
    const [name, time, content] = record.split('|');
    if (name) {
      result[deslug(name)] = { time: time || '', content: deslug(content) || '', posted: true };
    }
  });
  return result;
}
// ── 인물 속성 (성별/제한 명단) ──────────────────────────────
const CHEER_NAMES = ['아스트리아', '에밀리', '제시카', '미아', '요코', '스칼렛', '주디', '시드니'];
const FOOTBALL_NAMES = ['데릭', '서준', '테오', '리암', '윌리엄', '이안', '카이', '알렉스'];
const BASKETBALL_NAMES = ['카를로스', '존', '로빈', '리드넬', '에릭', '조나단', '레오', '케일럽'];
const BAND_NAMES = ['에반', '제일런'];

const CHEER_SET = new Set(CHEER_NAMES);
// 남학생: 풋볼팀+농구부+밴드부 전원, 댄스팀 중 다니엘/미카엘/루카스
const MALE_NAMES = new Set([...FOOTBALL_NAMES, ...BASKETBALL_NAMES, ...BAND_NAMES, '다니엘', '미카엘', '루카스']);
// 프릴 잠옷 허용: 치어리더부 전원 + 리아, 소피아
const FRILL_ALLOWED = new Set([...CHEER_NAMES, '리아', '소피아']);
// 교과서/공책 낙서 가능 인물 및 그중 심한 낙서 대상
const SKETCH_ALLOWED = new Set(['제시카', '요코', '시드니', '테오', '윌리엄', '카이', '알렉스', '로빈', '조나단', '레오', '케일럽', '루카스']);
const HEAVY_SKETCH = new Set(['제시카', '테오', '조나단']);

// 이름(+date+hour+salt)을 시드로 한 코인플립 (게시 여부 등에 재사용)
function hashChance(seedStr, thresholdPct) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash) % 100 < thresholdPct;
}

function hashPick(seedStr, pool) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

// "6월_12일_금" 같은 date에서 월(month)만 파싱 (여름 판정용)
function parseMonth(dateStr) {
  const m = String(dateStr || '').match(/(\d{1,2})월/);
  return m ? parseInt(m[1], 10) : null;
}

// ── 취침전(파자마 영상) 조합 ──────────────────────────────
function composeBedtime(name, date) {
  const seed = name + '_' + date + '_bedtime';
  const face = hashPick(seed + '_face', ['얼굴 보임', '얼굴 안 보임', '얼굴 반만 보임']);
  const pose = hashPick(seed + '_pose', ['누움', '옆으로 누움', '엎드림', '침대에 앉아있음']);

  let outfitPool = ['면 파자마', '실크 파자마', '반팔티에 바지'];
  if (MALE_NAMES.has(name)) outfitPool.push('상의 탈의');
  if (FRILL_ALLOWED.has(name)) outfitPool.push('프릴 잠옷');
  const outfit = hashPick(seed + '_outfit', outfitPool);

  const expr = hashPick(seed + '_expr', ['웃음', '졸림', '윙크', '메롱', '장난스러움']);
  const light = hashPick(seed + '_light', ['어두움', '밝음', '스탠드 켜짐', '무드등 켜짐']);
  const framing = hashPick(seed + '_frame', ['셀피', '신체 찍음', '방 안 찍음', '창밖 찍음']);

  const FACE_PHRASE = { '얼굴 보임': '얼굴 보이게', '얼굴 안 보임': '얼굴 안 보이게', '얼굴 반만 보임': '얼굴 반쯤 걸치게' };
  const LIGHT_PHRASE = { '어두움': '불 꺼진 어두운 방에서', '밝음': '환하게 불 켠 방에서', '스탠드 켜짐': '스탠드 불빛만 켠 채', '무드등 켜짐': '무드등만 켠 채' };
  const FRAME_PHRASE = { '셀피': '셀피로 찍음', '신체 찍음': '몸 위주로 찍음', '방 안 찍음': '방 안 풍경을 찍음', '창밖 찍음': '창밖을 찍음' };
  const outfitJosa = /[가-힣]$/.test(outfit) ? '차림으로' : '입고';

  return `${LIGHT_PHRASE[light]} 이불 속에서 ${pose}, ${outfit} ${outfitJosa} ${FACE_PHRASE[face]} ${expr} 표정, ${FRAME_PHRASE[framing]}`;
}

// ── 등교시간 조합 ──────────────────────────────
function composeGoingToSchool(name, date) {
  const seed = name + '_' + date + '_school';
  const locPool = name === '에밀리' ? ['조수석', '뒷자리'] : ['운전석', '조수석', '뒷자리', '교문', '교실', '부실'];
  const loc = hashPick(seed + '_loc', locPool);

  if (loc === '운전석') return '운전석에서 신호대기 중';
  if (loc === '조수석' || loc === '뒷자리') {
    const state = hashPick(seed + '_state', ['신호대기 중', '이동 중']);
    return `${loc}에서 ${state}`;
  }
  return `${loc} 도착`;
}

// ── 수업 시간 사진/영상 조합 ──────────────────────────────
function composeClassPhoto(name, date, hour) {
  const seed = name + '_' + date + '_' + hour + '_class';
  const category = hashPick(seed + '_cat', ['교과서', '공책', '덮음', '친구몰래']);

  if (category === '교과서' || category === '공책') {
    const noun = category === '교과서' ? '교과서' : '공책';
    if (SKETCH_ALLOWED.has(name) && hashChance(seed + '_doodle', 55)) {
      const heavy = HEAVY_SKETCH.has(name) && hashChance(seed + '_intensity', 50);
      return heavy ? `낙서가 잔뜩 된 ${noun}` : `낙서가 살짝 있는 ${noun}`;
    }
    return `깔끔하게 펼쳐진 ${noun}`;
  }
  if (category === '덮음') return '교과서와 공책이 덮여 있음';

  // 같은 동아리 친구를 몰래 찍음
  const position = hashPick(seed + '_pos', ['옆자리', '앞자리', '뒷자리']);
  const angle = hashPick(seed + '_angle', ['아래에서', '옆에서', '뒤에서', '앞에서']);
  const secrecy = hashPick(seed + '_secrecy', ['몰래', '대놓고']);
  const awareness = hashPick(seed + '_aware', ['인지 못함', '윙크', '미소', '브이']);
  const shake = hashChance(seed + '_shake', 30);

  const AWARE_VERB = { 윙크: '윙크함', 미소: '미소 지음', 브이: '브이 함' };
  let sentence = `${angle} ${position} 동아리 친구를 ${secrecy} 촬영`;
  sentence += awareness === '인지 못함'
    ? ', 친구는 눈치채지 못함'
    : `, 친구가 알아채고 ${AWARE_VERB[awareness]}`;
  if (shake) sentence += ', 찍다가 화면 흔들림';
  return sentence;
}

// ── 부활동 조합 ──────────────────────────────
function composeClub(groupKey, name, date, hour) {
  const seed = name + '_' + date + '_' + hour + '_club';
  const headcount = hashPick(seed + '_head', ['홀로', '여러 부원과 함께']);
  const framing = hashPick(seed + '_frame', ['셀피', '신체 찍음(땀 남)', '신체 찍음(땀 안 남)', '부원들 촬영', '부활동 장소 촬영']);

  let situationPool;
  if (groupKey === 'football' || groupKey === 'basketball') {
    situationPool = ['물 마시는 중', '앉아서 쉬는 중', '스트레칭하는 중', '달리기 훈련하는 중', '근력운동하는 중', '왕복달리기하는 중'];
  } else if (groupKey === 'cheer' || groupKey === 'dance') {
    situationPool = ['물 마시는 중', '앉아서 쉬는 중', '스트레칭하는 중', '동작 연습하는 중', '음악 고르는 중'];
  } else {
    situationPool = ['물 마시는 중', '앉아서 쉬는 중', '악보 보는 중'];
  }
  const situation = hashPick(seed + '_sit', situationPool);

  const FRAME_PHRASE = {
    '셀피': '셀피로 찍음',
    '신체 찍음(땀 남)': '땀에 젖은 몸을 찍음',
    '신체 찍음(땀 안 남)': '아직 땀 안 난 뽀송한 몸을 찍음',
    '부원들 촬영': '부원들을 찍음',
    '부활동 장소 촬영': '부활동 장소를 찍음'
  };
  return `${headcount} ${situation}, ${FRAME_PHRASE[framing]}`;
}

// ── 식사 조합 (치어리더부는 메뉴 제한) ──────────────────────────────
// 한글 단어 끝에 붙일 '로'/'으로' 조사 판별 (받침 없음/ㄹ받침 → 로, 그 외 받침 → 으로)
function withRoParticle(word) {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xAC00 || last > 0xD7A3) return word + '로';
  const finalIdx = (last - 0xAC00) % 28;
  return (finalIdx === 0 || finalIdx === 8) ? word + '로' : word + '으로';
}

function composeMeal(mealType, name, date) {
  const seed = name + '_' + date + '_' + mealType + '_meal';
  let menuPool = mealType === 'breakfast'
    ? ['햄버거', '샌드위치', '오믈렛', '토스트', '스크램블', '스프', '빵', '푸케', '또띠야']
    : ['스테이크', '파스타', '뇨끼', '치킨 텐더', '햄버거 세트'];
  if (CHEER_SET.has(name)) menuPool = ['샐러드', '야채 많은 포케', '또띠야'];
  const menu = hashPick(seed + '_menu', menuPool);

  let placePool;
  if (mealType === 'breakfast') placePool = ['집안', '차안'];
  else if (mealType === 'lunch') placePool = ['학교 식당', '학교 뒷마당'];
  else placePool = ['식당', '집'];
  const place = hashPick(seed + '_place', placePool);

  const label = { breakfast: '아침', lunch: '점심', dinner: '저녁' }[mealType];
  return `${place}에서 ${withRoParticle(menu)} ${label} 식사 중`;
}

// ── 비공식 파티 조합 (주말 밤) ──────────────────────────────
function composeParty(name, date) {
  const seed = name + '_' + date + '_party';
  const place = hashPick(seed + '_place', ['파티장 중심', '창가', '뒷마당', '소파']);
  const state = hashPick(seed + '_state', ['즐거움', '지침']);
  const item = hashPick(seed + '_item', ['펀치컵', '술잔']);
  const outfit = hashPick(seed + '_outfit', ['파티복', '평상복']);
  const music = hashPick(seed + '_music', ['시끄러운 음악', 'EDM', '힙합', '신나는 팝송']);
  const light = hashPick(seed + '_light', ['어두운 조명', '은은한 파티 조명', '환한 조명', '캔들라이트']);
  const action = hashPick(seed + '_action', ['쉬는 중', '춤추는 중', '대화하는 중', '술 마시는 중']);

  const PLACE_PHRASE = { '파티장 중심': '파티장 한가운데서', '창가': '창가에서', '뒷마당': '뒷마당에서', '소파': '소파에 앉아' };
  const STATE_PHRASE = { 즐거움: '즐거운 표정', 지침: '지친 표정' };

  return `${outfit} 입고 ${PLACE_PHRASE[place]} ${item} 들고 ${action}, ${music}이 흐르는 ${light} 아래, ${STATE_PHRASE[state]}`;
}

// ── 평일 17시 이후 자유시간 조합 ──────────────────────────────
function composeWeekdayFree(name, date, hour) {
  const seed = name + '_' + date + '_' + hour + '_free';
  const category = hashPick(seed + '_cat', ['운동', '공부', '산책', '여가', '식사']);

  if (category === '운동') {
    const type = hashPick(seed + '_type', ['헬스', '런닝', '조깅']);
    const place = type === '헬스' ? '헬스장' : hashPick(seed + '_loc', ['공원', '운동장']);
    return `${place}에서 ${type} 중`;
  }
  if (category === '공부') return '공부하는 중';
  if (category === '산책') {
    const place = hashPick(seed + '_walk', ['시내', '주택가', '공원']);
    return `${place} 산책 중`;
  }
  if (category === '여가') {
    const sub = hashPick(seed + '_leisure', ['독서', '게임', '휴식']);
    if (sub === '독서') {
      const book = hashPick(seed + '_book', ['시집', '소설', '에세이']);
      return `${book} 읽는 중`;
    }
    if (sub === '게임') {
      const genre = hashPick(seed + '_genre', ['RPG', '모험', '액션', '전략', '시뮬레이션', '스포츠', '레이싱', '음악']);
      const device = hashPick(seed + '_device', ['핸드폰', '컴퓨터', '닌텐도']);
      return `${device}로 ${genre} 게임 중`;
    }
    return '집에서 쉬는 중';
  }
  return composeMeal('dinner', name, date); // 식사
}

// ── 주말 시간대별 카테고리 + 조합 ──────────────────────────────
function composeWeekendActivity(name, date, hour) {
  const seed = name + '_' + date + '_' + hour + '_wk';
  const month = parseMonth(date);
  const isSummer = month !== null && month >= 6 && month <= 8;

  let categories;
  if (hour === null) categories = ['친구랑놀기', '휴식', '운동', '공부', '저녁'];
  else if (hour < 5) categories = ['자는중'];
  else if (hour < 8) categories = ['자는중', '취침전'];
  else if (hour < 11) categories = ['늦잠', '아침', '외출준비'];
  else if (hour < 13) categories = ['늦잠', '점심', '친구랑놀기', '외출준비', '운동', '쇼핑'];
  else if (hour < 18) categories = ['친구랑놀기', '운동', '공부', '휴식', '쇼핑', '독서', '요리', '게임', '산책'].concat(isSummer ? ['바다', '수영'] : ['수영']);
  else if (hour < 21) categories = ['저녁', '친구랑놀기', '휴식', '요리', '게임'];
  else if (hour < 23) categories = ['파티', '친구랑놀기', '휴식', '게임'];
  else categories = ['취침전', '자는중', '파티'];

  const category = hashPick(seed + '_cat', categories);

  if (category === '자는중') return { content: '자는 중', isBedtime: false };
  if (category === '취침전') return { content: composeBedtime(name, date), isBedtime: true };
  if (category === '늦잠') return { content: '늦잠 자는 중', isBedtime: false };
  if (category === '아침') return { content: composeMeal('breakfast', name, date), isBedtime: false };
  if (category === '점심') return { content: composeMeal('lunch', name, date), isBedtime: false };
  if (category === '저녁') return { content: composeMeal('dinner', name, date), isBedtime: false };
  if (category === '외출준비') return { content: '외출 준비 중', isBedtime: false };
  if (category === '친구랑놀기') return { content: '친구랑 노는 중', isBedtime: false };
  if (category === '운동') {
    const type = hashPick(seed + '_extype', ['헬스', '런닝', '조깅']);
    const place = type === '헬스' ? '헬스장' : hashPick(seed + '_exloc', ['공원', '운동장']);
    return { content: `${place}에서 ${type} 중`, isBedtime: false };
  }
  if (category === '산책') {
    const place = hashPick(seed + '_walk', ['시내', '주택가', '공원']);
    return { content: `${place} 산책 중`, isBedtime: false };
  }
  if (category === '쇼핑') {
    const place = hashPick(seed + '_shop', ['백화점', '마트', '일반 가게']);
    return { content: `${place}에서 쇼핑 중`, isBedtime: false };
  }
  if (category === '독서') {
    const book = hashPick(seed + '_book', ['시집', '소설', '에세이']);
    const place = hashPick(seed + '_bookplace', ['집', '도서관', '공원', '바닷가', '카페']);
    return { content: `${place}에서 ${book} 읽는 중`, isBedtime: false };
  }
  if (category === '요리') return { content: '집에서 요리하는 중', isBedtime: false };
  if (category === '게임') {
    const genre = hashPick(seed + '_genre', ['RPG', '모험', '퀴즈', '액션', '전략', '어드벤처', '시뮬레이션', '스포츠', '슈팅', '레이싱', '음악']);
    const device = hashPick(seed + '_device', ['아이패드', '컴퓨터', '플스', '핸드폰', '닌텐도']);
    return { content: `${device}로 ${genre} 게임 중`, isBedtime: false };
  }
  if (category === '휴식') {
    const loc = hashPick(seed + '_restloc', ['공원', '집', '방', '집 뒷마당', '바다']);
    const pose = hashPick(seed + '_restpose', ['누워있음', '앉아있음', '엎드림', '옆으로 누움']);
    let bg;
    if (loc === '공원' || loc === '집 뒷마당') bg = hashPick(seed + '_bg', ['잔디', '나무 아래']);
    else if (loc === '바다') bg = '모래사장';
    else bg = hashPick(seed + '_bg2', ['침대', '바닥', '러그', '소파', '안락소파']);
    const finalPose = bg === '안락소파' ? '앉아있음' : pose;
    return { content: `${loc} ${bg}에서 ${finalPose}`, isBedtime: false };
  }
  if (category === '바다') {
    const state = hashPick(seed + '_seastate', ['그냥 산책 중', '발을 물에 담금']);
    return { content: `바다에 가서 ${state}`, isBedtime: false };
  }
  if (category === '수영') {
    const place = isSummer ? hashPick(seed + '_swimplace', ['수영장', '바다']) : '수영장';
    let posePool = ['물에 떠있음', '튜브에 앉아있음', '썬체어에 앉아 쉼', '비치타올 두르고 앉음'];
    if (place === '바다') posePool = posePool.concat(['모래찜질 중', '파라솔 아래 있음']);
    const pose = hashPick(seed + '_swimpose', posePool);
    return { content: `${place}에서 ${pose}`, isBedtime: false };
  }
  if (category === '파티') return { content: composeParty(name, date), isBedtime: false };
  return { content: '휴식 중', isBedtime: false };
}

// 훈련(이른 등교/소집) 동기화 모드일 때 팀원들에게 배정할 상태
const TRAINING_SYNC_STATES = ['학교 갈 준비 중', '이미 도착해 몸 푸는 중', '대기중']; // 대기중=늦잠

// "HH:MM" 문자열에서 시(hour)만 파싱, 실패 시 null
function parseHour(timeStr) {
  if (!timeStr) return null;
  const h = parseInt(String(timeStr).split(':')[0], 10);
  return Number.isNaN(h) ? null : h;
}

// date 문자열 끝 토큰(요일)이 토/일이면 주말로 판정. 요일 정보 없으면 평일로 취급.
function isWeekend(dateStr) {
  if (!dateStr) return false;
  const tokens = String(dateStr).split(/[_\s]/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  return last === '토' || last === '일';
}

// 학교 스케줄 기준 고정 활동 마커 (8시~15시 수업, 15시~17시 부활동) — 평일 전용
// 해당 없음(17시 이후 자유시간이거나 시간 정보 없음)이면 null 반환
function scheduledActivity(hour) {
  if (hour === null) return null;
  if (hour < 5) return '취침 중';
  if (hour === 5) return '기상함';
  if (hour === 6) return '등교 준비 중';
  if (hour === 7) return '등교 중';
  if (hour >= 8 && hour < 12) return '수업 듣는 중';
  if (hour === 12) return '점심 식사 중';
  if (hour >= 13 && hour < 15) return '수업 듣는 중';
  if (hour >= 15 && hour < 17) return '부활동 중';
  return null; // 17시 이후는 자유시간
}

// scheduledActivity의 마커 문자열을 실제 조합된 문장으로 변환
// 반환: { content, isBedtime }
function resolveScheduled(marker, groupKey, name, date, hour) {
  if (marker === '취침 중') return { content: composeBedtime(name, date), isBedtime: true };
  if (marker === '등교 중') return { content: composeGoingToSchool(name, date), isBedtime: false };
  if (marker === '수업 듣는 중') return { content: composeClassPhoto(name, date, hour), isBedtime: false };
  if (marker === '점심 식사 중') return { content: composeMeal('lunch', name, date), isBedtime: false };
  if (marker === '부활동 중') return { content: composeClub(groupKey, name, date, hour), isBedtime: false };
  return { content: marker, isBedtime: false }; // 기상함/등교 준비 중은 그대로
}

// 그룹 로스터 + overrides(이름별 time/content/posted)를 합쳐 members 배열 생성
// date: 미지정 멤버 상태 시드 + 시간 동기화 + 평일/주말 판정용
// 스토리상 주요 캐릭터(프롬프트에 설정된 인물) — 이 명단은 언급 안 된 순간에도 65% 확률로 게시
// 나머지 로스터 멤버(엑스트라)는 50%
const MAIN_CAST = new Set([
  '데릭', '테오', '서준', '카이', '알렉스', '이안',
  '다니엘', '루카스',
  '아스트리아', '미아', '스칼렛', '주디',
  '에반',
  '로빈', '레오', '에릭', '조나단', '존'
]);

function buildGroupMembers(groupKey, overrides, date) {
  const group = GROUPS[groupKey];
  if (!group) return null;

  const rosterNames = new Set(group.roster.map(m => m.name));
  // 로스터에 없는 이름의 override는 무시 (다른 그룹 멤버를 잘못 넣은 경우 등)
  const validOverrides = {};
  for (const name in overrides) {
    if (rosterNames.has(name)) validOverrides[name] = overrides[name];
  }

  const overrideValues = Object.values(validOverrides);
  const sharedTime = (overrideValues.find(v => v.time) || {}).time || '';
  const hour = parseHour(sharedTime);
  const weekend = isWeekend(date);

  // 훈련 동기화 모드: 누군가의 override 내용에 "훈련"이 언급되면
  // 나머지 팀원도 그 흐름(준비중/몸풀기/늦잠)에 맞춰 통일
  const trainingMode = overrideValues.some(v => v.content && v.content.includes('훈련'));

  // 1차: 멤버별 draft 생성 (취침전 여부 플래그 포함)
  const draft = group.roster.map(m => {
    const ov = validOverrides[m.name];
    if (ov) {
      return { name: m.name, initial: m.initial, color: m.color, time: ov.time || '', content: ov.content || '', posted: true, isBedtime: false, isOverride: true };
    }

    // 훈련 동기화 모드가 최우선
    if (trainingMode) {
      const state = hashPick(m.name + '_' + date + '_train', TRAINING_SYNC_STATES);
      if (state === '대기중') {
        return { name: m.name, initial: m.initial, color: m.color, time: '', content: '', posted: false, isBedtime: false };
      }
      return { name: m.name, initial: m.initial, color: m.color, time: sharedTime, content: state, posted: true, isBedtime: false };
    }

    const postChance = MAIN_CAST.has(m.name) ? 65 : 50;

    // 주말: 고정 스케줄 없이, 게시 여부는 postChance% 판정 후 활동 랜덤
    if (weekend) {
      const posted = hashChance(m.name + '_' + date + '_weekend_post', postChance);
      if (!posted) return { name: m.name, initial: m.initial, color: m.color, time: '', content: '', posted: false, isBedtime: false };
      const result = composeWeekendActivity(m.name, date, hour);
      return { name: m.name, initial: m.initial, color: m.color, time: sharedTime, content: result.content, posted: true, isBedtime: result.isBedtime };
    }

    // 평일 8~17시: 학교 스케줄 적용, 게시 여부는 postChance% 판정
    const scheduled = scheduledActivity(hour);
    if (scheduled) {
      const posted = hashChance(m.name + '_' + date + '_' + hour + '_post', postChance);
      if (!posted) return { name: m.name, initial: m.initial, color: m.color, time: '', content: '', posted: false, isBedtime: false };
      const resolved = resolveScheduled(scheduled, groupKey, m.name, date, hour);
      return { name: m.name, initial: m.initial, color: m.color, time: sharedTime, content: resolved.content, posted: true, isBedtime: resolved.isBedtime };
    }

    // 17시 이후(평일 자유시간) 또는 시간 정보 없음: 게시 여부 postChance% 판정 후 활동 랜덤
    const posted = hashChance(m.name + '_' + date + '_free_post', postChance);
    if (!posted) return { name: m.name, initial: m.initial, color: m.color, time: '', content: '', posted: false, isBedtime: false };
    const content = composeWeekdayFree(m.name, date, hour);
    return { name: m.name, initial: m.initial, color: m.color, time: sharedTime, content, posted: true, isBedtime: false };
  });

  // 2차: 취침전(파자마 씬)이 자동배정으로 2명 이상 겹치면 "파자마 파티"로 통합
  const bedtimeMembers = draft.filter(x => x.isBedtime && x.posted && !x.isOverride);
  if (bedtimeMembers.length >= 2) {
    const names = bedtimeMembers.map(x => x.name);
    bedtimeMembers.forEach(x => {
      const others = names.filter(n => n !== x.name);
      x.content = `${others.join('·')}와 파자마 파티 중`;
    });
  }

  const members = draft.map(({ isBedtime, isOverride, ...rest }) => rest);
  return { title: group.title, members };
}

module.exports = (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const q = url.searchParams;

    const rawGroup = q.get('g') || q.get('group');
    const group = rawGroup ? (GROUP_ALIASES[rawGroup] || rawGroup) : rawGroup;
    const date = q.get('d') || q.get('date');
    const title = q.get('t') || q.get('title');
    const members = q.get('members');

    if (!date) {
      res.status(400).send('d(date) 파라미터가 필요합니다.');
      return;
    }

    let finalTitle, finalMembers;

    if (group) {
      // p: "이름|시간|내용~이름2|시간2|내용2" 형식 (list.js/detail.js와 동일 구분자 컨벤션)
      const parsedOverrides = parsePosted(q.get('p'));
      const built = buildGroupMembers(group, parsedOverrides, date);
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

    // 타임라인 점 표시용 현재 시각(members 중 시간이 있는 첫 항목 기준)
    const displayTime = (finalMembers.find(m => m.time) || {}).time || '';
    const displayHour = parseHour(displayTime);

    const svg = buildSvg({ title: finalTitle, date, members: finalMembers, hour: displayHour });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(svg);
  } catch (err) {
    res.status(500).send('셋로그 생성 중 오류가 발생했습니다.');
  }
};
