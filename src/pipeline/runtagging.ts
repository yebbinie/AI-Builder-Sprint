/// <reference types="node" />
/**
 * 태깅 결과 확인용 스크립트
 *
 *   npx tsx -r dotenv/config src/pipeline/runtagging.ts
 *
 * repeated/faded/resolved를 붙이기 전에
 * 토픽이 제대로 뽑히는지 눈으로 먼저 확인한다.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DiaryEntry } from './preprocess';
import { tag, groupByTopic } from './tagging';
import { callSolar } from './llm';

const INPUT = path.join(__dirname, 'fixtures', 'july-diary.json');

function loadEntries(): DiaryEntry[] {
    const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
    return raw.map((e: { date: string; text?: string; body?: string }) => ({
        date: e.date,
        text: e.text ?? e.body ?? '',
    }));
}

async function main() {
    const entries = loadEntries();
    const tagged = await tag(entries, callSolar);

    console.log('\n─── 문장별 태깅 ───');
    for (const s of tagged) {
        const mark =
            s.polarity === 'positive' ? '+' : s.polarity === 'negative' ? '-' : ' ';
        const topics = s.topics.length ? s.topics.join(', ') : '—';
        console.log(`  ${mark} [${topics}] ${s.date}  ${s.text.slice(0, 40)}`);
    }

    console.log('\n─── 토픽별 등장 ───');
    const groups = groupByTopic(tagged);
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [topic, list] of sorted) {
        const dates = [...new Set(list.map((s) => s.date.slice(5)))];
        const neg = list.filter((s) => s.polarity === 'negative').length;
        const pos = list.filter((s) => s.polarity === 'positive').length;
        console.log(
            `  ${topic.padEnd(8)} ${list.length}회 (+${pos}/-${neg})  ${dates.join(' ')}`
        );
    }
}

main().catch((e: Error) => {
    console.error('실패:', e.message);
    process.exit(1);
});