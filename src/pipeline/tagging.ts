/**
 * ② 태깅 — 문장마다 주제(topics)와 감정 극성(polarity)을 붙인다
 *
 * ③의 repeated / faded / resolved가 전부 이 결과에 의존한다.
 *
 * 극성을 여기서 함께 뽑는 이유:
 *   - 어차피 LLM 호출 한 번이므로 비용이 늘지 않는다
 *   - '해결됐는지'의 판정이 코드에 남는다. 조립 LLM에게 맡기면
 *     근거가 프롬프트 안으로 숨어서 검증할 수 없다
 */

import { DiaryEntry, Sentence, preprocess } from './preprocess';
import { LLMCaller } from './extract';

export interface TaggedSentence {
    date: string;
    text: string;              // 원문 그대로
    index: number;             // 그 날 안에서의 순서
    topics: string[];          // 예: ['보고서', '잠']
    polarity: 'positive' | 'negative' | 'neutral';
}

const TAGGING_SYSTEM = `너는 일기 문장에 주제와 감정을 라벨링하는 역할이다.
문장을 새로 쓰지 않는다. 라벨만 붙인다.

[topics — 주제]
- 그 문장이 무엇에 대한 것인지 명사로 뽑는다. 1~3개.
- 짧고 일반적인 명사를 쓴다. "최종보고서"가 아니라 "보고서", "수면부족"이 아니라 "잠"
- 같은 대상은 항상 같은 이름으로 부른다. 한 일기에서 "보고서"라고 했으면 끝까지 "보고서"
- 자주 나올 만한 예: 보고서, 잠, 지갑, 스터디, 친구, 가족, 음식, 날씨, 공부, 운동
- 뽑을 게 없으면 빈 배열

[polarity — 그 문장의 감정]
- "negative": 걱정, 힘듦, 짜증, 불안, 못 자겠음, 잃어버림 등
- "positive": 즐거움, 다행, 해결됨, 맛있음, 뿌듯함 등
- "neutral": 사실 서술만 있고 감정이 드러나지 않음

[중요]
걱정하던 일이 해결된 문장은 반드시 "positive"다.
("지갑 찾았다", "요즘은 잠이 잘 온다", "보고서 제출" 등)

[출력 형식]
JSON 배열만. 설명·머리말·코드블록 금지.
입력에 있는 **모든 문장**에 대해 하나씩, 순서대로 출력한다.
[{"date":"YYYY-MM-DD","index":0,"topics":["보고서"],"polarity":"negative"}]

text는 출력하지 않는다. date와 index로만 식별한다.`;

/** LLM에 넘길 입력 — 문장마다 번호를 붙여 대응시킨다 */
function buildInput(sentences: Sentence[]): string {
    const byDate = new Map<string, Sentence[]>();
    for (const s of sentences) {
        if (!byDate.has(s.date)) byDate.set(s.date, []);
        byDate.get(s.date)!.push(s);
    }
    return [...byDate.entries()]
        .map(
            ([date, list]) =>
                `[${date}]\n` + list.map((s) => `${s.index}: ${s.text}`).join('\n')
        )
        .join('\n\n');
}

function parseJSON<T>(raw: string): T[] {
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
    // 잘린 응답 복구
    const objects = cleaned.match(/\{[^{}]*\}/g) ?? [];
    const salvaged: T[] = [];
    for (const o of objects) {
        try {
            salvaged.push(JSON.parse(o));
        } catch {
            /* 버림 */
        }
    }
    return salvaged;
}

/**
 * 비슷한 토픽을 하나로 합친다.
 * LLM이 "보고서"와 "최종보고서"를 섞어 쓰면 신호가 흩어지기 때문.
 * 짧은 쪽이 긴 쪽에 포함되면 짧은 쪽으로 통일한다.
 */
function canonicalize(all: string[]): Map<string, string> {
    const uniq = [...new Set(all)].sort((a, b) => a.length - b.length);
    const map = new Map<string, string>();
    for (const t of uniq) {
        const base = uniq.find((u) => u !== t && u.length < t.length && t.includes(u));
        map.set(t, base ?? t);
    }
    return map;
}

/**
 * ② 태깅 실행
 * LLM이 일부 문장을 빠뜨리는 일이 있으므로, 누락된 문장은 neutral로 채운다.
 */
/** 한 번에 보낼 문장 수 — 너무 많으면 LLM이 뒤쪽을 흘린다 */
const CHUNK_SIZE = 15;

/**
 * ② 태깅 실행
 *
 * 문장을 한 번에 다 보내면 LLM이 뒤쪽을 빠뜨린다.
 * (49개를 던졌을 때 실행마다 3~6개씩 누락됐고, 그 때문에 신호 결과가 널뛰었다)
 * 날짜 단위로 묶어 작은 덩어리로 나눠 보낸다.
 */
export async function tag(
    entries: DiaryEntry[],
    callLLM: LLMCaller
): Promise<TaggedSentence[]> {
    const sentences = preprocess(entries);
    console.log('\n[태깅]');

    // 날짜가 덩어리 사이에서 쪼개지지 않게 날짜 단위로 묶는다
    const byDate = new Map<string, Sentence[]>();
    for (const s of sentences) {
        if (!byDate.has(s.date)) byDate.set(s.date, []);
        byDate.get(s.date)!.push(s);
    }

    const chunks: Sentence[][] = [];
    let current: Sentence[] = [];
    for (const list of byDate.values()) {
        if (current.length + list.length > CHUNK_SIZE && current.length) {
            chunks.push(current);
            current = [];
        }
        current.push(...list);
    }
    if (current.length) chunks.push(current);

    type Item = {
        date: string;
        index: number;
        topics?: string[];
        polarity?: TaggedSentence['polarity'];
    };

    const all: Item[] = [];
    for (let i = 0; i < chunks.length; i++) {
        const raw = await callLLM(TAGGING_SYSTEM, buildInput(chunks[i]));
        const items = parseJSON<Item>(raw);
        all.push(...items);
    }

    const byKey = new Map<string, Item>();
    for (const it of all) {
        byKey.set(`${it.date}#${it.index}`, it);
    }

    // 토픽 표기 통일
    const canon = canonicalize(all.flatMap((it) => it.topics ?? []));

    let missing = 0;
    const tagged: TaggedSentence[] = sentences.map((s) => {
        const hit = byKey.get(`${s.date}#${s.index}`);
        if (!hit) missing++;
        return {
            date: s.date,
            text: s.text,
            index: s.index,
            topics: (hit?.topics ?? []).map((t) => canon.get(t) ?? t),
            polarity: hit?.polarity ?? 'neutral',
        };
    });

    console.log(
        `  → ${chunks.length}회 호출, 문장 ${sentences.length}개 중 ${sentences.length - missing}개 태깅됨`
    );
    if (missing) console.warn(`  ⚠️ ${missing}개는 LLM이 빠뜨려서 neutral 처리`);

    return tagged;
}

/** 토픽별로 문장을 묶는다 (③에서 사용) */
export function groupByTopic(
    tagged: TaggedSentence[]
): Map<string, TaggedSentence[]> {
    const map = new Map<string, TaggedSentence[]>();
    for (const s of tagged) {
        for (const topic of s.topics) {
            if (!map.has(topic)) map.set(topic, []);
            map.get(topic)!.push(s);
        }
    }
    for (const list of map.values()) {
        list.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
    }
    return map;
}