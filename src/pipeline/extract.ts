/**
 * ③ 추출 — 편지에 넣을 "재료" 찾기
 *
 * LLM 신호:  unspoken_effort(말 안 한 노력), good_day(좋았던 날)
 * 코드 신호: repeated / faded / resolved  → signals.ts
 *
 * ⚠️ 설계 원칙: LLM은 개수 제한·형식·톤을 잘 지키지 않는다.
 *    프롬프트로 부탁하되, 실제 강제는 전부 코드에서 한다.
 */

import { DiaryEntry, Sentence, preprocess, getContext } from './preprocess';
import { tag } from './tagging';
import { extractCodeSignals } from './signals';

/**
 * TODO: 사람 3의 src/pipeline/types.ts와 통합되면
 *       아래 정의를 지우고 import로 교체.
 */
export interface ExtractedSignal {
    category: 'repeated' | 'faded' | 'resolved' | 'unspoken_effort' | 'good_day';
    quote: string;   // 원문 그대로, 한 글자도 수정 없음
    date: string;    // YYYY-MM-DD
    context?: string; // 조립 때 참고용 힌트 (인용 자체는 quote를 쓴다)
}

export type LLMCaller = (system: string, user: string) => Promise<string>;

/** 코드로 강제하는 상한 */
const MAX_EFFORT = 3;
const MAX_GOOD_DAY = 4;
const EFFORT_MAX_LEN = 45;

/**
 * good_day에 들어오면 안 되는 표현.
 * plan.md §10 안전 설계 — 부정 감정 문장은 단독으로 인용하지 않는다.
 */
const NEGATIVE_HINTS =
    /우울|짜증|힘들|멘탈|잃어버|못 찾|안 온다|잠이 안|새벽 (세|네|다섯)시|죽을뻔|눈물|싫다|막막|누워서|하는 것도 없이/;

/**
 * 장면 없이 감상만 있는 문장. "7월이 벌써 다 갔네" 같은 것.
 * 짧다는 이유로 거르면 "지갑 찾았다!!!" 같은 좋은 문장까지 날아가므로
 * 길이가 아니라 표현으로만 판단한다.
 */
const NO_SCENE = /벌써 다 갔|한 달이 |이번 달 뭐|시간 참 빠/;

// ─────────────────────────────────────────────
// 프롬프트
// ─────────────────────────────────────────────

const EFFORT_SYSTEM = `너는 일기에서 "본인은 대수롭지 않게 적었지만 실제로는 쉽지 않았던 일"을 찾아내는 역할이다.
문장을 새로 쓰지 않는다. 주어진 문장 중에서 고르기만 한다.

[무엇을 찾는가]
사람은 힘든 시기에 뭔가를 해내도 그걸 한 줄로 툭 적고 넘어간다.
자랑도 안 하고, 감탄도 안 하고, 그냥 사실만 적는다.
그런 문장을 찾는 것이다.

[좋은 예 — 이런 걸 찾아라]
✅ "아침에 좀 걸었다." — 앞뒤에 우울하다는 서술이 있으면, 이건 큰일이다
✅ "일단 자료 폴더만 만들어놨다" — 막막한 일을 어쨌든 시작한 것
✅ "두 장 봤다 뭐 시작은 시작이지" — 본인은 별거 아니라는 듯 적었지만 다시 시작한 것
✅ "보고서 초안 다 썼다" — 며칠 잠 못 잤다는 기록 뒤라면 의미가 다르다

[고르지 말 것]
❌ 감탄부호가 여러 개 붙어 신나 있는 문장 ("제출!!!!!!!!", "지갑 찾았다!!!!!!!!!")
   → 본인이 이미 기뻐한 일은 '말 안 한' 게 아니다
❌ 감정만 서술하고 행동이 없는 문장 ("너무 우울해", "기분이 좋았다")
❌ 놀거나 먹은 일 — 그건 좋았던 날이지 노력이 아니다

[판단 방법]
그 문장 자체만 보지 말고 **주변 날짜의 기록**을 함께 봐라.
앞뒤에 힘들다·막막하다·못 자겠다 같은 서술이 있는데
그 사이에 조용히 뭔가를 한 기록이 있으면 그게 답이다.

1~${MAX_EFFORT}개를 고른다. 한 달치 일기라면 보통 2~3개는 있다.

[출력 형식]
JSON 배열만. 설명·머리말·코드블록 금지.
[{"date":"YYYY-MM-DD","quote":"원문 그대로"}]

quote는 입력 문장을 한 글자도 바꾸지 않고 그대로 옮긴다.
여러 문장을 합치거나 줄바꿈으로 이어붙이지 마라. 반드시 한 문장씩 따로 넣는다.`;

const GOOD_DAY_SYSTEM = `너는 일기에서 "그 달의 좋았던 순간"을 골라내는 역할이다.
문장을 새로 쓰지 않는다. 주어진 문장 중에서 고르기만 한다.

[반드시 지킬 것]
1. 한 날짜에서는 **한 문장만** 고른다. 그 날을 가장 잘 보여주는 하나를 고른다.
2. **한 달 전체에 고루 퍼지게** 고른다. 초순·중순·하순에서 각각 골라라.
   앞쪽 날짜만 고르면 실패다.
3. 힘들었던 문장은 절대 고르지 않는다.
   ("우울해", "잠이 안 온다", "지갑을 잃어버렸다", "새벽 세시에 잠들었다" 같은 것)
   같은 날에 좋은 문장이 따로 있으면 그쪽을 골라라.

[우선순위 — 위쪽이 더 좋다]
1. 구체적인 장면·사물·행동이 담긴 문장
   ("좋았다"보다 "벤치에 고양이 두 마리 앉아있는 거 봄"이 좋다)
2. 함께 있었던 사람이나 장소가 나오는 문장
3. 본인이 들떠서 쓴 문장 (감탄부호가 많아도 좋다)

[출력 형식]
JSON 배열만. 설명·머리말·코드블록 금지.
[{"date":"YYYY-MM-DD","quote":"원문 그대로"}]

quote는 입력 문장을 한 글자도 바꾸지 않고 그대로 옮긴다.
이모티콘, 느낌표, 오타까지 전부 유지한다.
여러 문장을 합치거나 줄바꿈으로 이어붙이지 마라. 반드시 한 문장씩 따로 넣는다.`;

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────

/**
 * 공백 차이를 무시하고 대조하기 위한 정규화.
 * LLM이 인용에 공백을 하나 더 넣거나 빼는 일이 흔해서,
 * 멀쩡한 인용이 통째로 버려지는 걸 막는다.
 */
function normalize(s: string): string {
    return s.replace(/\s+/g, '').trim();
}

function existsInOriginalLoose(quote: string, entries: DiaryEntry[]): boolean {
    const q = normalize(quote);
    if (!q) return false;
    return entries.some((e) => normalize(e.text).includes(q));
}

function buildUserInput(sentences: Sentence[]): string {
    const byDate = new Map<string, Sentence[]>();
    for (const s of sentences) {
        if (!byDate.has(s.date)) byDate.set(s.date, []);
        byDate.get(s.date)!.push(s);
    }
    return [...byDate.entries()]
        .map(([date, list]) => `[${date}]\n` + list.map((s) => `- ${s.text}`).join('\n'))
        .join('\n\n');
}

/**
 * LLM 응답에서 항목을 뽑는다.
 * 배열로 안 감싼 경우, 중간에 잘린 경우 모두 살려낸다.
 */
function parseJSON<T>(raw: string, label: string): T[] {
    const cleaned = raw.replace(/```json|```/g, '').trim();

    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end > start) {
        try {
            const parsed = JSON.parse(cleaned.slice(start, end + 1));
            if (Array.isArray(parsed) && parsed.length) return parsed;
        } catch {
            /* 아래로 */
        }
    }

    const objects = cleaned.match(/\{[^{}]*\}/g) ?? [];
    const salvaged: T[] = [];
    for (const o of objects) {
        try {
            salvaged.push(JSON.parse(o));
        } catch {
            /* 버림 */
        }
    }
    if (salvaged.length) return salvaged;

    console.warn(`  ⚠️ [${label}] 파싱 실패:`, cleaned.slice(0, 200));
    return [];
}

type RawItem = { date: string; quote: string };

/** LLM이 여러 문장을 줄바꿈으로 이어붙인 경우 첫 줄만 쓴다 */
function firstLineOnly(items: RawItem[]): RawItem[] {
    return items.map((it) => ({
        ...it,
        quote: (it.quote ?? '').split('\n')[0].replace(/^-\s*/, '').trim(),
    }));
}

/** 원본에 실제로 존재하는 인용만 남긴다 */
function keepOnlyReal(
    items: RawItem[],
    entries: DiaryEntry[],
    sentences: Sentence[]
): RawItem[] {
    return items.filter((it) => {
        if (!it.quote) return false;
        // 완전 일치가 안 되더라도 원문 문장을 찾을 수 있으면 살린다
        const ok = existsInOriginalLoose(it.quote, entries) || !!findOriginal(it.quote, sentences);
        if (!ok) console.warn('  ⚠️ 원본에 없어서 제거:', it.quote.slice(0, 30));
        return ok;
    });
}

/** 같은 문장 중복 제거 */
function dedupe(items: RawItem[]): RawItem[] {
    const seen = new Set<string>();
    return items.filter((it) => {
        const k = normalize(it.quote);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

/** 한 날짜당 한 문장만 남긴다 */
function onePerDate(items: RawItem[]): RawItem[] {
    const seen = new Set<string>();
    return items.filter((it) => {
        if (seen.has(it.date)) return false;
        seen.add(it.date);
        return true;
    });
}

/**
 * 한 달 전체에 고루 퍼지게 고른다.
 * 앞에서 n개를 자르면 초순 날짜만 남아 편지가 한 달을 담지 못한다.
 */
function spreadAcrossMonth(items: RawItem[], count: number): RawItem[] {
    if (items.length <= count) return items;
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    const step = (sorted.length - 1) / (count - 1);
    const picked: RawItem[] = [];
    for (let i = 0; i < count; i++) {
        picked.push(sorted[Math.round(i * step)]);
    }
    return picked;
}

/**
 * '말 안 한 노력'의 형식 조건.
 * - 신나서 쓴 문장은 이 카테고리가 아니다 (본인이 이미 말했으므로)
 * - 걱정만 서술한 문장도 아니다. 노력은 '행동'이어야 한다.
 *   ("요즘 잠이 잘 안 온다"가 effort로 새면 편지에 힘든 얘기가 단독 인용된다)
 */
function isQuietSentence(quote: string): boolean {
    const t = quote.trim();
    if (t.length > EFFORT_MAX_LEN) {
        console.warn(`  ⚠️ 너무 길어서 제거(${t.length}자):`, t.slice(0, 25) + '…');
        return false;
    }
    if (/!{2,}/.test(t)) {
        console.warn('  ⚠️ 들떠 있어서 제거:', t.slice(0, 25));
        return false;
    }
    if (NEGATIVE_HINTS.test(t)) {
        console.warn('  ⚠️ 행동이 아니라 걱정이라 제거:', t.slice(0, 25));
        return false;
    }
    return true;
}

/** good_day에 부정적인 문장이 섞이는 것을 막는다 (안전 설계) */
function isPositiveSentence(quote: string): boolean {
    if (NEGATIVE_HINTS.test(quote)) {
        console.warn('  ⚠️ 힘든 문장이라 제외:', quote.slice(0, 30));
        return false;
    }
    if (NO_SCENE.test(quote.trim())) {
        console.warn('  ⚠️ 장면이 없어서 제외:', quote.slice(0, 30));
        return false;
    }
    return true;
}

/**
 * LLM이 준 인용을 원본 문장으로 되돌린다.
 *
 * LLM은 조사를 붙이거나("지갑 찾았다" → "지갑을 찾았다") 어미를 다듬는 일이 잦다.
 * 완전 일치가 안 되면 부분 포함으로도 찾아본다. 저장되는 것은 언제나 원문이다.
 */
function findOriginal(quote: string, sentences: Sentence[]): Sentence | undefined {
    const q = normalize(quote);
    const exact = sentences.find((s) => normalize(s.text) === q);
    if (exact) return exact;

    // 원문이 LLM 인용을 포함하거나, 그 반대인 경우
    const partial = sentences
        .filter((s) => {
            const t = normalize(s.text);
            return t.includes(q) || q.includes(t);
        })
        // 길이가 가장 비슷한 것을 고른다
        .sort(
            (a, b) =>
                Math.abs(normalize(a.text).length - q.length) -
                Math.abs(normalize(b.text).length - q.length)
        )[0];

    return partial;
}

function toSignal(
    it: RawItem,
    sentences: Sentence[],
    category: ExtractedSignal['category'],
    withContext: boolean
): ExtractedSignal {
    const target = findOriginal(it.quote, sentences);
    return {
        category,
        quote: target ? target.text : it.quote,
        date: target ? target.date : it.date,
        ...(withContext && target ? { context: getContext(sentences, target) } : {}),
    };
}

// ─────────────────────────────────────────────
// LLM 신호
// ─────────────────────────────────────────────

/** 말 안 한 노력 */
export async function extractUnspokenEffort(
    entries: DiaryEntry[],
    callLLM: LLMCaller
): Promise<ExtractedSignal[]> {
    const sentences = preprocess(entries);
    console.log('\n[말 안 한 노력]');
    const raw = await callLLM(EFFORT_SYSTEM, buildUserInput(sentences));
    const items = parseJSON<RawItem>(raw, 'effort');

    const kept = spreadAcrossMonth(
        onePerDate(
            dedupe(keepOnlyReal(firstLineOnly(items), entries, sentences)).filter((it) =>
                isQuietSentence(it.quote)
            )
        ),
        MAX_EFFORT
    );

    console.log(`  → LLM ${items.length}개 → 통과 ${kept.length}개`);
    return kept.map((it) => toSignal(it, sentences, 'unspoken_effort', true));
}

/** 좋았던 날 */
export async function extractGoodDays(
    entries: DiaryEntry[],
    callLLM: LLMCaller,
    excludeDates: string[] = [],
    excludeQuotes: string[] = []
): Promise<ExtractedSignal[]> {
    const sentences = preprocess(entries);
    console.log('\n[좋았던 날]');
    const raw = await callLLM(GOOD_DAY_SYSTEM, buildUserInput(sentences));
    const items = parseJSON<RawItem>(raw, 'good_day');

    const excluded = new Set(excludeDates);
    const excludedQuotes = new Set(excludeQuotes.map(normalize));
    const kept = spreadAcrossMonth(
        onePerDate(
            dedupe(keepOnlyReal(firstLineOnly(items), entries, sentences))
                .filter((it) => isPositiveSentence(it.quote))
                // 이미 다른 신호로 쓴 날짜·문장은 건너뛴다
                // (같은 문장이 편지에 두 번 인용되면 바로 티가 난다)
                .filter((it) => !excluded.has(it.date))
                .filter((it) => !excludedQuotes.has(normalize(it.quote)))
        ),
        MAX_GOOD_DAY
    );

    // LLM이 적게 뱉는 날이 있다. 부족하면 코드가 후보에서 채운다.
    const filled = fillGoodDays(kept, sentences, excluded, excludedQuotes, MAX_GOOD_DAY);

    console.log(
        `  → LLM ${items.length}개 → 통과 ${kept.length}개` +
        (filled.length > kept.length ? ` (+${filled.length - kept.length}개 보충)` : '')
    );
    return filled.map((it) => toSignal(it, sentences, 'good_day', false));
}

/**
 * good_day가 부족할 때 코드로 채운다.
 * LLM 응답은 호출마다 개수가 들쭉날쭉해서, 편지 재료가 갑자기 비는 일이 있다.
 * 조건(긍정·장면 있음·중복 없음)을 만족하는 문장 중 긴 것부터 채운다.
 */
function fillGoodDays(
    kept: RawItem[],
    sentences: Sentence[],
    excludedDates: Set<string>,
    excludedQuotes: Set<string>,
    target: number
): RawItem[] {
    if (kept.length >= target) return kept;

    const usedDates = new Set([...kept.map((k) => k.date), ...excludedDates]);
    const candidates = sentences
        .filter((s) => !usedDates.has(s.date))
        .filter((s) => !excludedQuotes.has(normalize(s.text)))
        .filter((s) => isPositiveSentence(s.text))
        .filter((s) => s.text.trim().length >= 15)
        // 구체적인 장면이 담긴 문장일수록 길다
        .sort((a, b) => b.text.length - a.text.length);

    const added: RawItem[] = [];
    for (const c of candidates) {
        if (kept.length + added.length >= target) break;
        if (usedDates.has(c.date)) continue;
        usedDates.add(c.date);
        added.push({ date: c.date, quote: c.text });
    }

    return spreadAcrossMonth([...kept, ...added], target);
}

// ─────────────────────────────────────────────
// 전체
// ─────────────────────────────────────────────

/**
 * ③ 전체 — 사람 3에게 넘길 최종 배열
 * 코드 신호(repeated/faded/resolved) + LLM 신호(effort/good_day)
 */
export async function extract(
    entries: DiaryEntry[],
    callLLM: LLMCaller
): Promise<ExtractedSignal[]> {
    // ② 태깅 — 코드 신호가 이 결과에 의존한다
    const tagged = await tag(entries, callLLM);
    const codeSignals = extractCodeSignals(tagged);

    const effortRaw = await extractUnspokenEffort(entries, callLLM);

    // 같은 문장이 두 카테고리에 들어가면 편지에 두 번 인용된다.
    // 코드 신호(repeated/resolved)는 '몇 번 썼는지·언제 끝났는지'라는
    // 편지에서만 할 수 있는 이야기를 담으므로 그쪽을 남긴다.
    const codeQuotes = new Set(codeSignals.map((s) => normalize(s.quote)));
    const effort = effortRaw.filter((e) => !codeQuotes.has(normalize(e.quote)));
    const codeFiltered = codeSignals;

    // 날짜는 effort 것만 뺀다 (코드 신호 날짜까지 빼면 후보가 너무 줄어든다).
    // 대신 이미 인용된 '문장'은 모두 제외해서 중복 인용을 막는다.
    const good = await extractGoodDays(
        entries,
        callLLM,
        effort.map((s) => s.date),
        [...codeFiltered.map((s) => s.quote), ...effort.map((s) => s.quote)]
    );

    return [...codeFiltered, ...effort, ...good].sort((a, b) =>
        a.date.localeCompare(b.date)
    );
}