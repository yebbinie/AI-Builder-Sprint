// src/pipeline/assemble.ts
import { ExtractedSignal } from './types';
import { LetterParagraph, LetterSegment } from '../types';

const UPSTAGE_API_KEY = process.env.EXPO_PUBLIC_UPSTAGE_API_KEY;
const ENDPOINT = 'https://api.upstage.ai/v1/chat/completions';
const MODEL = 'solar-pro3';

const CLOSING_LINE = '다음 달의 너는 이걸 잊고 있을 텐데, 그래도 한 번은 읽어줬으면 좋겠다.';

/**
 * ── 설계 메모 (2026-08-01) ────────────────────────────────
 *
 * 목표로 삼은 손글씨 예시 편지를 보면 인용이 전부 **짧은 조각**이다.
 *   "잠을 못 잔다" / "날씨 좋다" / "면접 보고 온 날" / "복숭아 한 박스"
 * 조각이라서 문장 안에 문법적으로 녹아든다.
 *
 * 그런데 신호의 quote는 문장 전체다.
 *   "저녁에 엄마가 옥수수 삶아줬는데 이게 여름이지……"
 * 이걸 그대로 재료로 주면 모델은 붙여넣고 뒤에 "라는 말이 떠올라"를 다는 것 말고
 * 할 수 있는 게 없다. 실제로 그렇게 나왔고, 느낌표 여덟 개까지 그대로 딸려왔다.
 *
 * 그래서 순서를 이렇게 바꿨다.
 *   ① 각 신호에서 **짧은 핵심 조각**을 먼저 뽑는다 (원문의 부분 문자열이어야 함)
 *   ② 조립 LLM에게는 전체 문장이 아니라 그 조각만 준다 → 통째로 붙여넣는 게 불가능해짐
 *   ③ 편지가 나오면 코드가 원문과 일치하는 부분을 찾아 인용으로 표시한다
 *
 * 조각은 정의상 원문의 부분 문자열이므로 "탭하면 그날 일기" 검증은 그대로 유지된다.
 */

/* ────────────────────────────────────────────────
 * ① 핵심 조각 뽑기
 * ──────────────────────────────────────────────── */

const PHRASE_SYSTEM = `일기 문장에서 편지에 옮겨 쓸 **짧은 핵심 조각**을 뽑는 일이다.

[규칙]
1. 반드시 원문에 있는 글자를 **그대로 잘라내라.** 단어를 바꾸거나 조사를 붙이지 마라.
2. 4~14자 사이. 짧을수록 좋다.
3. 문장의 핵심이 되는 부분을 골라라. 부수적인 내용은 버려라.
4. 느낌표·물음표·말줄임표·ㅋㅋ·ㅎㅎ는 조각에 넣지 마라.

[중요] **누가 했는지가 적혀 있으면 반드시 포함해라.**
"옥수수 삶아줬는데"만 남기면 누가 삶아준 건지 사라진다.

[예]
"저녁에 엄마가 옥수수 삶아줬는데 이게 여름이지……" → "엄마가 옥수수 삶아줬는데"
"요즘 잠이 잘 안 온다 누우면 보고서 생각만 남……" → "잠이 잘 안 온다"
"어디서부터 써야하지 일단 자료 폴더만 만들어놨다 그리고 점심에 마라탕 먹음ㅎㅎ" → "자료 폴더만 만들어놨다"
"지갑 찾았다!!!!!!!!!" → "지갑 찾았다"
"오늘은 도서관 가서 자격증 문제집 폈다 두 장 봤다 뭐 시작은 시작이지" → "자격증 문제집 폈다"

[출력]
JSON 배열만. 입력 순서 그대로, 개수도 그대로.
["조각1","조각2",...]`;

/** LLM이 실패했을 때를 대비한 코드 백업 */
function fallbackPhrase(quote: string): string {
  const s = quote.replace(/[\s!?.…~ㅋㅎㅠㅜ]+$/g, '').trim();
  if (s.length <= 16) return s;
  const words = s.split(/\s+/);
  const out: string[] = [];
  // 한국어는 뒤쪽에 서술의 핵심이 오는 경우가 많다
  for (let i = words.length - 1; i >= 0; i--) {
    const cand = [words[i], ...out].join(' ');
    if (cand.length > 16) break;
    out.unshift(words[i]);
  }
  return out.join(' ') || s.slice(0, 16);
}

async function callLLM(system: string, user: string, temperature: number): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${UPSTAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Upstage API 호출 실패: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function parseJSONArray(raw: string): unknown[] {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 공백 차이를 무시한 부분 문자열 검사 */
function isSubstring(frag: string, quote: string): boolean {
  const n = (s: string) => s.replace(/\s+/g, '');
  return n(quote).includes(n(frag)) && frag.trim().length >= 3;
}

async function extractPhrases(signals: ExtractedSignal[]): Promise<string[]> {
  const input = signals.map((s, i) => `${i + 1}. ${s.quote}`).join('\n');
  let picked: unknown[] = [];
  try {
    picked = parseJSONArray(await callLLM(PHRASE_SYSTEM, input, 0.1));
  } catch {
    /* 아래 백업으로 */
  }

  let fallbackCount = 0;
  const phrases = signals.map((s, i) => {
    const cand = typeof picked[i] === 'string' ? (picked[i] as string).trim() : '';
    // 원문에 없는 조각은 쓸 수 없다 (지어낸 말이 편지에 들어가면 안 됨)
    if (cand && isSubstring(cand, s.quote)) return cand;
    fallbackCount++;
    return fallbackPhrase(s.quote);
  });

  console.log(
    `  핵심 조각 ${phrases.length}개${fallbackCount ? ` (${fallbackCount}개는 코드 백업)` : ''}`
  );
  return phrases;
}

/* ────────────────────────────────────────────────
 * ② 편지 조립
 * ──────────────────────────────────────────────── */

/** 편지 한 통에 넣을 최대 인용 수 (plan.md 조립 규칙 3) */
const MAX_QUOTES = 7;

/**
 * 신호를 추려낸다.
 *
 * 9개를 전부 주면 모델이 한 문단에 두세 개씩 욱여넣어서
 * "옥수수 삶아줬는데 너는 여전히 잠이 잘 안 온다며" 같은 억지 연결이 나온다.
 * 편지에 필요한 건 다 넣는 게 아니라 잘 이어지는 몇 개다.
 */
function selectSignals(signals: ExtractedSignal[]): ExtractedSignal[] {
  if (signals.length <= MAX_QUOTES) return signals;

  // 편지의 뼈대가 되는 순서 — 걱정이 지나간 이야기가 가장 중요하다
  const priority: Record<string, number> = {
    resolved: 0,
    faded: 1,
    repeated: 2,
    unspoken_effort: 3,
    good_day: 4,
  };

  const picked: ExtractedSignal[] = [];
  const usedCategory = new Map<string, number>();
  const limit: Record<string, number> = {
    resolved: 2,
    faded: 1,
    repeated: 1,
    unspoken_effort: 2,
    good_day: 3,
  };

  for (const s of [...signals].sort(
    (a, b) => (priority[a.category] ?? 9) - (priority[b.category] ?? 9)
  )) {
    const n = usedCategory.get(s.category) ?? 0;
    if (n >= (limit[s.category] ?? 1)) continue;
    usedCategory.set(s.category, n + 1);
    picked.push(s);
    if (picked.length >= MAX_QUOTES) break;
  }

  return picked.sort((a, b) => a.date.localeCompare(b.date));
}






/**
 * 문단 계획을 코드가 짠다.
 *
 * 조각만 던져주고 "알아서 엮어봐" 하면 모델은 쓰기 편한 것만 골라 쓴다.
 * 실제로 그 달에서 가장 좋은 이야기(지갑을 잃었다가 찾은 것)가 통째로 빠졌다.
 * 그래서 어떤 문단에 무엇을 쓸지 여기서 정해서 넘긴다.
 *
 * 순서는 목표로 삼은 예시 편지의 흐름을 따른다.
 *   인사 → 지나간 걱정 → 조용히 해낸 일 → 해결된 걱정 → 좋았던 날들 → (마무리는 코드)
 */
interface ParagraphPlan {
  guide: string;
  items: { phrase: string; fact: string; note?: string }[];
}

function buildPlan(signals: ExtractedSignal[], phrases: string[]): ParagraphPlan[] {
  const of = (cat: string) =>
    signals
      .map((s, i) => ({ s, phrase: phrases[i], fact: s.quote }))
      .filter((x) => x.s.category === cat);

  const plans: ParagraphPlan[] = [];

  const worry = [...of('repeated'), ...of('faded')];
  if (worry.length) {
    plans.push({
      guide: '자주 썼던 얘기인데 뒤로 갈수록 사라졌다. 언제부터였는지는 모른다.',
      items: worry.map((x) => ({ phrase: x.phrase, fact: x.fact })),
    });
  }

  const effort = of('unspoken_effort');
  if (effort.length) {
    plans.push({
      guide:
        '힘들다고 쓰던 무렵에 조용히 해낸 일. 담담하게 짚어라. ' +
        '칭찬하거나 대단한 일이라고 의미를 부여하지 마라.',
      items: effort.slice(0, 1).map((x) => ({ phrase: x.phrase, fact: x.fact })),
    });
  }

  // 해결된 걱정은 각각 문단을 따로 준다.
  // 한 문단에 둘을 넣으면 "보고서 초안 다 썼다. 지갑 찾았다는 한 줄은…"처럼
  // 서로 상관없는 두 사건이 한 호흡에 붙어버린다.
  for (const x of of('resolved').slice(0, 2)) {
    plans.push({
      guide:
        '**먼저 걱정하던 상황을 한두 문장으로 써라.** 그게 없으면 해결됐다는 말이 붕 뜬다. ' +
        '"지갑 찾았다"만 있고 잃어버린 얘기가 없으면 무슨 소린지 알 수 없다. ' +
        '참고 맥락을 네 말로 풀어 쓰되 원문 그대로 옮기지는 마라. 그 다음에 조각으로 넘어가라.',
      items: [
        {
          phrase: x.phrase,
          fact: x.fact,
          note: x.s.context ? `처음엔 이랬음: ${x.s.context}` : undefined,
        },
      ],
    });
  }

  const good = of('good_day');
  if (good.length) {
    plans.push({
      guide: '가볍게 훑어라. 마지막 문장은 한 달 전체를 닫는 감상으로.',
      items: good.slice(0, 3).map((x) => ({ phrase: x.phrase, fact: x.fact })),
    });
  }

  return plans;
}

/* ────────────────────────────────────────────────
 * ③ 조각 링크 걸기
 * ──────────────────────────────────────────────── */

const MIN_FRAGMENT = 6;

interface Hit {
  at: number;
  frag: string;
  date: string;
}

/**
 * 편지 본문에서 '핵심 조각'을 찾는다.
 *
 * 원문 전체를 대상으로 아무 부분 문자열이나 찾으면 "것 같아" 같은
 * 흔한 표현이 우연히 걸려서 엉뚱한 날짜로 링크된다. (실제로 그랬다)
 * 그래서 ①에서 뽑은 조각만 대상으로 하고, 그 조각의 대부분이
 * 그대로 등장할 때만 인용으로 인정한다.
 */
function findPhrase(text: string, phrase: string): { at: number; frag: string } | null {
  const direct = text.indexOf(phrase);
  if (direct !== -1) return { at: direct, frag: phrase };

  /**
   * 조각을 줄일 때는 **앞에서만** 잘라낸다.
   *
   * 뒤를 자르면 서술어가 날아가서 사실이 바뀐다.
   * 실제로 "보고서 초안 다 썼다"가 "보고서 초안 다"까지만 매칭되는 바람에
   * 모델이 붙인 "만들었더라"가 인용처럼 읽히는 일이 있었다.
   * 인용을 탭하면 원문이 나오는 서비스라 이건 치명적이다.
   * 링크를 하나 못 걸더라도 사실이 어긋나는 것보다 낫다.
   */
  const words = phrase.split(/\s+/);
  for (let st = 1; st < words.length; st++) {
    const frag = words.slice(st).join(' ');
    if (frag.length < MIN_FRAGMENT) break;
    const at = text.indexOf(frag);
    if (at !== -1) return { at, frag };
  }
  return null;
}

/**
 * 조각과 그 뒤 텍스트가 겹치는 걸 없앤다.
 * 모델이 "잠이 잘 안 온다" 뒤에 "다고"를 붙여 "온다다고"가 되는 일이 있다.
 */
function fixJunction(frag: string, after: string): string {
  // "온다" + "다고" → "온다" + "고"
  for (let n = Math.min(2, frag.length); n >= 1; n--) {
    if (after.startsWith(frag.slice(-n))) return after.slice(n);
  }
  // "온다" + " 고 자주" → "온다" + "고 자주"  (조사 앞 공백 제거)
  const m = after.match(/^\s+(고|는|던|도|만|을|를|이|가|와|과|로|에|라고|라는)([\s,.])/);
  if (m) return after.replace(/^\s+/, '');
  return after;
}

function linkParagraph(
  text: string,
  signals: ExtractedSignal[],
  phrases: string[],
  used: Set<number>
): LetterSegment[] {
  const hits: Hit[] = [];

  for (let i = 0; i < signals.length; i++) {
    if (used.has(i)) continue;
    const found = findPhrase(text, phrases[i]);
    if (!found) continue;
    const overlaps = hits.some(
      (h) => found.at < h.at + h.frag.length && h.at < found.at + found.frag.length
    );
    if (overlaps) continue;
    hits.push({ at: found.at, frag: found.frag, date: signals[i].date });
    used.add(i);
  }

  if (hits.length === 0) return [{ type: 'text', content: text }];

  hits.sort((a, b) => a.at - b.at);
  const segments: LetterSegment[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.at > cursor) segments.push({ type: 'text', content: text.slice(cursor, h.at) });
    segments.push({ type: 'quote', content: h.frag, date: h.date });
    cursor = h.at + h.frag.length;
    // 조각 끝 글자가 뒤 텍스트 앞에 또 나오는 경우를 정리한다
    const rest = fixJunction(h.frag, text.slice(cursor));
    if (rest !== text.slice(cursor)) {
      cursor += text.slice(cursor).length - rest.length;
    }
  }
  if (cursor < text.length) segments.push({ type: 'text', content: text.slice(cursor) });
  return segments;
}

/* ────────────────────────────────────────────────
 * 검증
 * ──────────────────────────────────────────────── */

const BANNED = [
  '하면 좋겠다',
  '좋았으면',
  '잊지 않았으면',
  '기억해 두면',
  '해보자',
  '대단해',
  '대단하다',
  '잘했어',
  '훌륭',
  '자랑스',
  '경향이 있',
  '패턴이',
  '믿어',
  '응원',
  '라는 말이',
  '라는 한 줄',
  '라고도 적었',
];

/** 프롬프트 예시에만 나오는 표현 — 편지에 등장하면 베낀 것이다 */
const EXAMPLE_PHRASES = [
  // 예시 편지에만 나오는 사건 — 등장하면 베낀 것이다
  '그날이 제일',
  '벤치에 고양이',
  '면접 보고 온 날',
  '여섯 글자로',
  '라면 얘기',
  '날씨 좋다',
  '적어두는 사람이구나',
  '사람 만나는 게 부담',
  // 지시문에 쓰인 표현 — 모델이 그대로 옮기는 일이 잦다
  '별거 아니라고 생각했겠지',
  '별일 아니라고',
  '그렇게 안 보였',
  '조용히 해낸',
  '큰 차이',
  '작은 일들이 모여',
];

/**
 * 검증 결과를 두 갈래로 나눈다.
 *
 * critical — 반드시 고쳐야 하는 것. 하나라도 있으면 계속 다시 만든다.
 *            (존댓말·평서문·지어낸 표현·인용 부족처럼 편지가 성립 안 되는 문제)
 * minor    — 다듬으면 좋은 것. 어미 반복 같은 문체 문제.
 *            이것만 남으면 몇 번 더 시도해보고, 안 되면 그대로 쓴다.
 *            (전부 만족시키려다 스무 번을 돌려도 통과 못 하는 일이 있었다)
 */
function validate(
  paragraphs: LetterParagraph[],
  signals: ExtractedSignal[]
): { critical: string[]; minor: string[] } {
  const critical: string[] = [];
  const minor: string[] = [];

  const full = paragraphs.map((p) => p.segments.map((s) => s.content).join('')).join('\n');
  const textOnly = paragraphs
    .map((p) => p.segments.filter((s) => s.type === 'text').map((s) => s.content).join(''))
    .join('\n');

  // ── 치명적 ──
  const banned = BANNED.find((b) => full.includes(b));
  if (banned) critical.push(`금지 표현 "${banned}"`);

  const copied = EXAMPLE_PHRASES.find((e) => full.includes(e));
  if (copied) critical.push(`예시 복사 "${copied}"`);

  const declarative = textOnly.match(/[가-힣](?<!겠)다[.。]/);
  if (declarative) critical.push(`평서문 "${declarative[0]}"`);

  if (/[다음함네](라고|라는)/.test(full)) critical.push('"~다라고" 비문');

  const guess = ['모양이더라', '모양이야', '듯싶', '것으로 보'].find((g) => textOnly.includes(g));
  if (guess) critical.push(`추측투 "${guess}"`);

  if (!/[.。]/.test(textOnly)) critical.push('마침표 없음');

  const bangs = (full.match(/!/g) ?? []).length;
  if (bangs >= 4) critical.push(`느낌표 ${bangs}개`);

  const dates = (full.match(/\d{1,2}일/g) ?? []).length;
  if (dates >= 2) critical.push(`날짜 ${dates}회`);

  const leaked = signals
    .map((s) => s.context)
    .find((c) => c && c.length > 10 && full.includes(c.slice(0, 12)));
  if (leaked) critical.push('참고 맥락 유출');

  const linked = paragraphs.flatMap((p) => p.segments.filter((s) => s.type === 'quote')).length;
  const need = Math.min(3, Math.ceil(signals.length / 2));
  if (linked < need) critical.push(`인용 ${linked}개 (최소 ${need})`);

  // ── 사소한 (문체) ──
  const quoteLike = (textOnly.match(/라(는|고|던)/g) ?? []).length;
  if (quoteLike >= 3) minor.push(`"라고/라는" ${quoteLike}회`);

  const deora = (textOnly.match(/더라/g) ?? []).length;
  if (deora >= 4) minor.push(`"더라" ${deora}회`);

  const jeok = (textOnly.match(/적(혀|었|은|어)/g) ?? []).length;
  if (jeok >= 3) minor.push(`"적혀/적었" ${jeok}회`);

  const naBwa = (textOnly.match(/나 봐/g) ?? []).length;
  if (naBwa >= 3) minor.push(`"나 봐" ${naBwa}회`);

  const lengthTalk = (textOnly.match(/분량|한 줄로|짧고 담담|글자|간결/g) ?? []).length;
  if (lengthTalk >= 2) minor.push(`길이 얘기 ${lengthTalk}회`);

  // 한두 문장짜리 문단이 많으면 편지가 아니라 메모다
  const shortParas = paragraphs
    .slice(1)
    .map((p) => p.segments.map((s) => s.content).join(''))
    .filter((t) => t.trim().length > 0 && (t.match(/[.。]/g) ?? []).length < 2);
  if (shortParas.length >= 2) minor.push(`짧은 문단 ${shortParas.length}개`);

  // 조각이 하나도 안 들어간 문단은 지어낸 얘기일 가능성이 높다
  const noQuote = paragraphs
    .slice(1)
    .filter((p) => !p.segments.some((s) => s.type === 'quote')).length;
  if (noQuote >= 2) minor.push(`인용 없는 문단 ${noQuote}개`);

  const openings = paragraphs
    .slice(1)
    .map((p) => (p.segments[0]?.content ?? '').trim().slice(0, 6))
    .filter((o) => o.length >= 4);
  const dupOpening = openings.find((o, i) => openings.indexOf(o) !== i);
  if (dupOpening) minor.push(`문단 첫머리 반복 "${dupOpening}"`);

  for (let i = 0; i + 6 <= textOnly.length; i++) {
    const chunk = textOnly.slice(i, i + 6);
    if (/[\n.,]/.test(chunk)) continue;
    if (textOnly.indexOf(chunk, i + 6) !== -1) {
      minor.push(`표현 반복 "${chunk}"`);
      break;
    }
  }

  return { critical, minor };
}

/* ────────────────────────────────────────────────
 * 문단 단위 생성
 *
 * 편지 전체를 한 번에 쓰게 하면 한 군데만 어긋나도 통째로 다시 만들어야 한다.
 * 15번을 돌려도 매번 다른 곳에서 터졌다.
 * 문단을 하나씩 만들고 문단 단위로 다시 쓰게 하면 훨씬 빨리 수렴한다.
 * 앞 문단에서 이미 쓴 어미를 알려줄 수 있어서 반복도 막을 수 있다.
 * ──────────────────────────────────────────────── */

const PARA_SYSTEM = `너는 지난달의 "나"다. 지난달 일기장을 넘겨보며 다음 달의 나에게 편지를 쓰고 있다.
지금은 **편지의 한 문단만** 쓴다.

# ★ 절대 규칙 — 일기에 적힌 것 외에는 아무것도 쓰지 마라

"이 날 일기에 적힌 것"이 주어진다. 거기 없는 건 단 한 글자도 쓰면 안 된다.
그날 날씨가 어땠는지, 어디서 잃어버렸는지, 어떤 기분이었는지 — **너는 모른다.**

  ❌ "지갑 잃어버려서 온종일 찾아 헤매다가 가방에 넣은 걸 모르고 나왔구나"
     (어디서 잃어버렸는지, 얼마나 찾았는지 일기에 없다)
  ❌ "그날은 평소보다 여유롭게 느껴졌어" (그런 서술 없다)
  ❌ "점심에 함께 나누던 한기가 떠올라" (없는 얘기다)

**쓸 말이 부족하면 짧게 끝내라. 두 문장이어도 괜찮다.**
억지로 늘리려고 상상하는 순간 실패다.

# 문단 구조 (2~3문장)
1) 조각을 녹인 문장 — 일기에 적힌 사실
2) (있으면) 일기에 적힌 다른 사실 한 줄
3) 짧은 감상 한마디 — 이건 네가 지어도 된다. 대신 **한 문장**만.

# 규칙
- 반말. 문장마다 마침표.
- 조각을 **문장 안에 녹여라.** 앞에 놓고 "~라고 적혀 있더라"를 붙이지 마라.
    ❌ "지갑 찾았다라고 적혀 있더라."
    ✅ "지갑 찾았다고 쓴 날은 느낌표가 아홉 개였어."
- **조각의 글자는 바꾸지 마라.** 어미를 붙이는 건 되지만 단어를 바꾸면 안 된다.
- 말하는 글이다. "~다."로 끝내지 마라. ("났다"✗ → "났어"○)
- 추측투 금지. "적었던 모양이더라"✗ → "적었더라"○
- 감상은 담백하게. 예언·격려 금지.
    ❌ "이 작은 시작이 언젠가 큰 흐름으로 이어질 날이 올 거야."
    ✅ "그런 것들은 늘 그렇게 지나가나 봐."

# 금지
평가·칭찬(대단하다, 잘했다, 큰 차이) / 조언(~하면 좋겠다, 다음 달엔) /
분석(경향, 패턴) / 느낌표 / 날짜("13일에")

# 출력
문단 텍스트만. 따옴표·설명·JSON 없이 문단 하나만.`;

/** 어미가 한쪽으로 쏠리는 걸 막기 위해 이미 쓴 표현을 센다 */
function overusedEndings(prev: string): string[] {
  const out: string[] = [];
  const count = (re: RegExp) => (prev.match(re) ?? []).length;
  if (count(/더라/g) >= 2) out.push('~더라');
  if (count(/적(혀|었|은)/g) >= 2) out.push('~적었다 / ~적혀 있더라');
  if (count(/라(고|는)/g) >= 1) out.push('~라고 / ~라는');
  if (count(/나 봐/g) >= 1) out.push('~나 봐');
  if (count(/그 무렵/g) >= 1) out.push('그 무렵');
  return out;
}

function buildParaPrompt(
  plan: ParagraphPlan,
  prevText: string,
  isLast: boolean
): string {
  const facts = plan.items.map((it) => `  "${it.fact}"`).join('\n');
  const items = plan.items
    .map(
      (it) =>
        `  · ${it.phrase}` +
        (it.note
          ? `\n    [배경 — 네 말로 바꿔 써라. 그대로 옮기면 실패다]\n    ${it.note}`
          : '')
    )
    .join('\n');

  const avoid = overusedEndings(prevText);
  const avoidLine = avoid.length
    ? `\n[이번 문단에서 쓰지 말 것] 앞 문단에서 이미 썼다 — ${avoid.join(', ')}`
    : '';

  // "앞 문단을 받아서 이어지게 써줘"라고 했더니 앞 문단을 통째로 다시 썼다.
  // 참고용이라는 걸 분명히 하고, 반복 금지를 못 박는다.
  const prevLine = prevText
    ? `\n[바로 앞 문단 — 참고만 해라. 절대 다시 쓰지 마라]\n${prevText}\n` +
    `이 문단 **다음에 올** 문단을 써라. 앞 문단에 나온 내용·문장을 반복하면 실패다.`
    : '';

  const lastLine = isLast
    ? '\n[추가] 이 문단이 본문의 마지막이야. 마지막 문장은 한 달 전체를 닫는 감상으로.'
    : '';

  return `[이 날 일기에 적힌 것 — 여기 없는 내용은 절대 쓰지 마라]
${facts}

[이 문단이 할 일]
${plan.guide}

[문장에 녹여 쓸 조각]
${items}
${prevLine}${avoidLine}${lastLine}

문단 하나만 써줘.`;
}

/** 문단 하나에 대한 검사 */
function checkParagraph(text: string, phrases: string[], prevText = ''): string[] {
  const bad: string[] = [];
  const t = text.trim();

  const sentences = (t.match(/[.。]/g) ?? []).length;
  if (sentences < 2) bad.push(`문장 ${sentences}개`);
  if (sentences > 4) bad.push(`문장 ${sentences}개(너무 김)`);

  const declarative = t.match(/[가-힣](?<!겠)다[.。]/);
  if (declarative) bad.push(`평서문 "${declarative[0]}"`);

  if (/[다음함네](라고|라는)/.test(t)) bad.push('"~다라고" 비문');
  if (/모양이|듯싶|것으로 보/.test(t)) bad.push('추측투');
  if ((t.match(/!/g) ?? []).length > 0) bad.push('느낌표');
  if (/\d{1,2}일/.test(t)) bad.push('날짜');

  const banned = BANNED.find((b) => t.includes(b));
  if (banned) bad.push(`금지 "${banned}"`);
  const copied = EXAMPLE_PHRASES.find((e) => t.includes(e));
  if (copied) bad.push(`예시 복사 "${copied}"`);

  // 조각이 실제로 들어갔는지 (앞부분만 잘라 쓰는 것도 허용)
  const hit = phrases.some((ph) => findPhrase(t, ph));
  if (!hit) bad.push('조각 없음');

  // 앞 문단을 그대로 옮겨오는 일이 잦다
  if (prevText) {
    for (let i = 0; i + 10 <= prevText.length; i++) {
      const chunk = prevText.slice(i, i + 10);
      if (chunk.includes('\n')) continue;
      if (t.includes(chunk)) {
        bad.push('앞 문단 반복');
        break;
      }
    }
  }

  return bad;
}

async function writeParagraph(
  plan: ParagraphPlan,
  prevText: string,
  isLast: boolean
): Promise<string> {
  const phrases = plan.items.map((it) => it.phrase);
  const notes = plan.items.map((it) => it.note ?? '').filter(Boolean);
  let best = '';
  let bestScore = -99;

  for (let i = 0; i < 5; i++) {
    const raw = await callLLM(
      PARA_SYSTEM,
      buildParaPrompt(plan, prevText, isLast),
      Math.min(0.7 + i * 0.07, 1.0)
    );
    const text = raw
      .replace(/```/g, '')
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .replace(/\s*\n\s*/g, ' ') // 문단 안 줄바꿈 정리
      .trim();
    if (!text) continue;

    const bad = checkParagraph(text, phrases, prevText);
    // 참고 맥락(원래 걱정하던 일기 문장)을 그대로 옮겨오면 안 된다
    for (const n of notes) {
      const body = n.replace(/^처음엔 이랬음:\s*/, '');
      if (body.length > 10 && text.includes(body.slice(0, 12))) {
        bad.push('참고 맥락 유출');
        break;
      }
    }
    if (bad.length === 0) return text;

    const score = -bad.length;
    if (score > bestScore) {
      bestScore = score;
      best = text;
    }
    console.log(`    · 문단 재시도 ${i + 1}: ${bad.join(', ')}`);
  }
  return best;
}

/* ────────────────────────────────────────────────
 * 진입점
 * ──────────────────────────────────────────────── */

export async function assembleLetter(
  signals: ExtractedSignal[],
  monthLabel: string
): Promise<{ paragraphs: LetterParagraph[]; signature: string }> {
  if (!UPSTAGE_API_KEY) {
    throw new Error('EXPO_PUBLIC_UPSTAGE_API_KEY가 .env에 설정되어 있지 않습니다.');
  }

  const chosen = selectSignals(signals);
  console.log(`[assembleLetter] 신호 ${signals.length}개 중 ${chosen.length}개 사용`);

  const phrases = await extractPhrases(chosen);
  const plans = buildPlan(chosen, phrases);

  const texts: string[] = ['잘 지내고 있으려나.'];
  for (let i = 0; i < plans.length; i++) {
    console.log(`  [문단 ${i + 2}/${plans.length + 1}]`);
    const para = await writeParagraph(
      plans[i],
      texts[texts.length - 1], // 누적본을 주면 전부 다시 쓴다. 직전 문단만.
      i === plans.length - 1
    );
    if (para) texts.push(para);
  }

  const used = new Set<number>();
  const paragraphs: LetterParagraph[] = texts.map((t) => ({
    segments: linkParagraph(t, chosen, phrases, used),
  }));

  const linked = paragraphs.flatMap((p) => p.segments.filter((s) => s.type === 'quote')).length;
  const { critical, minor } = validate(paragraphs, chosen);
  console.log(
    `  → 문단 ${paragraphs.length}개, 인용 ${linked}개` +
    (critical.length ? ` / ✖ ${critical.join(', ')}` : '') +
    (minor.length ? ` / △ ${minor.join(', ')}` : '') +
    (!critical.length && !minor.length ? ' ✅' : '')
  );

  const monthNumber = monthLabel.match(/(\d+)월/)?.[1];
  return {
    paragraphs: [...paragraphs, { segments: [{ type: 'text', content: CLOSING_LINE }] }],
    signature: monthNumber ? `— ${monthNumber}월의 나로부터` : '— 지난달의 나로부터',
  };
}