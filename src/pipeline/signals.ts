/**
 * ③ 추출 (코드 파트) — repeated / faded / resolved
 *
 * 이 세 신호는 LLM이 아니라 코드가 판정한다.
 * '몇 번 썼는지', '언제부터 안 나오는지'는 세는 문제이고,
 * LLM에게 맡기면 부정확할 뿐 아니라 판정 근거가 프롬프트 안으로 숨는다.
 */

import { TaggedSentence, groupByTopic } from './tagging';
import { ExtractedSignal } from './extract';

/** 토픽이 '걱정거리'로 인정되려면 부정 문장이 최소 몇 번 나와야 하는가 */
const MIN_NEGATIVE = 2;
/** repeated로 인정할 최소 등장 일수 */
const MIN_REPEATED_DAYS = 3;

/** 카테고리별 상한 — 편지 인용이 4~6개를 넘지 않게 (plan.md 조립 규칙 3) */
const MAX_REPEATED = 1;
const MAX_FADED = 1;
const MAX_RESOLVED = 3;

/**
 * 걱정 토픽 판정.
 *
 * 부정 문장 개수만 세면 '롯데'(야구 져서 아쉬움)처럼 하루짜리 아쉬움도 걸린다.
 * 진짜 걱정은 **여러 날에 걸쳐** 반복되므로, 부정이 나온 날짜 수로 판정한다.
 */
function isWorryTopic(sentences: TaggedSentence[]): boolean {
    const negativeDays = new Set(
        sentences.filter((s) => s.polarity === 'negative').map((s) => s.date)
    );
    return negativeDays.size >= MIN_NEGATIVE;
}

/** 그 토픽이 등장한 서로 다른 날짜 수 */
function dayCount(sentences: TaggedSentence[]): number {
    return new Set(sentences.map((s) => s.date)).size;
}

/**
 * 반복된 감정 — 같은 걱정을 여러 날에 걸쳐 쓴 것.
 * 본인은 절대 셀 수 없는 값이다.
 */
export function extractRepeated(tagged: TaggedSentence[]): ExtractedSignal[] {
    const groups = groupByTopic(tagged);
    const found: { signal: ExtractedSignal; days: number }[] = [];

    for (const [topic, sentences] of groups) {
        if (!isWorryTopic(sentences)) continue;
        const days = dayCount(sentences);
        if (days < MIN_REPEATED_DAYS) continue;

        // 가장 처음 걱정한 문장을 인용한다
        const first = sentences.find((s) => s.polarity === 'negative');
        if (!first) continue;

        found.push({
            days,
            signal: {
                category: 'repeated',
                quote: first.text,
                date: first.date,
                context: `'${topic}' 이야기가 ${days}일에 걸쳐 나옴`,
            },
        });
    }

    return found
        .sort((a, b) => b.days - a.days)
        .slice(0, MAX_REPEATED)
        .map((f) => f.signal);
}

/**
 * 사라진 걱정 / 해결된 걱정
 *
 * faded    — 전반부에 걱정하다 후반부에 아예 언급이 없어진 것.
 *            언제 괜찮아졌는지 본인도 모른다.
 * resolved — 후반부에 그 토픽이 긍정으로 다시 등장한 것.
 *            걱정이 끝나는 장면이 일기에 실제로 남아 있다.
 *
 * 후반부에 나왔는데 여전히 부정이면 아직 진행 중이므로 넘기지 않는다.
 * (plan.md §10 — 해결되지 않은 부정 감정은 편지에 인용하지 않는다)
 */
export function extractFadedAndResolved(
    tagged: TaggedSentence[]
): ExtractedSignal[] {
    const allDates = [...new Set(tagged.map((s) => s.date))].sort();
    if (allDates.length < 4) return [];
    const lastDate = allDates[allDates.length - 1];

    const groups = groupByTopic(tagged);
    const faded: ExtractedSignal[] = [];
    const resolved: { signal: ExtractedSignal; gap: number }[] = [];

    for (const [topic, sentences] of groups) {
        if (!isWorryTopic(sentences)) continue;

        const negatives = sentences.filter((s) => s.polarity === 'negative');
        const negDays = new Set(negatives.map((s) => s.date));
        console.log(
            `    · '${topic}' 걱정 ${negDays.size}일 [${[...negDays].map((d) => d.slice(5)).join(' ')}]`
        );

        /**
         * 월 전체를 반으로 자르지 않는다.
         *
         * 토픽마다 시작 시점이 다르기 때문이다. 지갑은 20일에 잃어버렸는데
         * 월 중간(14일) 기준으로 나누면 걱정이 전부 '후반부'에 몰려
         * 전반부가 비고, 그래서 아무 신호도 안 잡혔다.
         * 기준선은 **그 토픽의 마지막 걱정 시점**이어야 한다.
         */
        const lastWorry = negatives[negatives.length - 1];
        const after = sentences.filter((s) => s.date > lastWorry.date);

        // 걱정 이후에 그 토픽이 다시 안 나옴 → 사라진 걱정
        if (after.length === 0) {
            // 단, 월말 직전에 걱정이 끝났으면 '사라졌다'고 보기 어렵다
            const daysLeft = allDates.filter((d) => d > lastWorry.date).length;
            if (daysLeft < 2) {
                console.log(`      → '${topic}' 아직 진행 중으로 보임, 제외`);
                continue;
            }
            faded.push({
                category: 'faded',
                quote: negatives[0].text,
                date: negatives[0].date,
                context: `'${topic}' 이야기가 ${lastWorry.date.slice(5)} 이후로는 나오지 않음`,
            });
            continue;
        }

        // 걱정 이후에 긍정으로 다시 등장 → 해결된 걱정
        const positives = after.filter((s) => s.polarity === 'positive');
        if (positives.length === 0) {
            console.log(`      → '${topic}' 걱정 이후 긍정 문장 없음, 제외`);
            continue;
        }

        /**
         * 문장만 봐도 무엇이 해결됐는지 알 수 있어야 한다.
         * "끝!!!!!!!!"처럼 그 자체로는 맥락을 알 수 없는 문장이 뽑히면
         * 편지에 인용됐을 때 의미가 사라진다.
         */
        const pick =
            positives.find((s) => s.text.includes(topic)) ??
            positives.find((s) => s.text.trim().length >= 12) ??
            positives[0];

        const gap =
            new Date(pick.date).getTime() - new Date(negatives[0].date).getTime();

        resolved.push({
            gap,
            signal: {
                category: 'resolved',
                quote: pick.text,
                date: pick.date,
                // 조립 단계에서 "~라고 썼었는데" 식으로 대비시킬 수 있게 처음 걱정을 남긴다
                context: negatives[0].text,
            },
        });
    }

    /**
     * 같은 사건이 resolved 자리를 두 번 차지하지 않게 한다.
     * '보고서'와 '잠'은 "누우면 보고서 생각만 남"처럼 사실상 한 서사라
     * 해결 날짜가 같으면 하나만 남긴다.
     */
    const seenDate = new Set<string>();
    const pickedResolved = resolved
        .sort((a, b) => b.gap - a.gap) // 오래 끌던 걱정일수록 편지에서 힘이 있다
        .filter((r) => {
            if (seenDate.has(r.signal.date)) return false;
            seenDate.add(r.signal.date);
            return true;
        })
        .slice(0, MAX_RESOLVED)
        .map((r) => r.signal);

    return [...faded.slice(0, MAX_FADED), ...pickedResolved];
}

/** 코드 기반 신호 전체 */
export function extractCodeSignals(tagged: TaggedSentence[]): ExtractedSignal[] {
    const repeated = extractRepeated(tagged);
    const fadedResolved = extractFadedAndResolved(tagged);

    // repeated와 같은 문장이 중복되지 않게
    const used = new Set(fadedResolved.map((s) => s.quote));
    const dedupedRepeated = repeated.filter((s) => !used.has(s.quote));

    const nFaded = fadedResolved.filter((s) => s.category === 'faded').length;
    const nResolved = fadedResolved.filter((s) => s.category === 'resolved').length;

    console.log('\n[코드 신호]');
    console.log(
        `  → repeated ${dedupedRepeated.length}개, faded ${nFaded}개, resolved ${nResolved}개`
    );

    return [...dedupedRepeated, ...fadedResolved];
}