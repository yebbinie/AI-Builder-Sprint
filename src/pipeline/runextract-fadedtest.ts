/// <reference types="node" />
/**
 * faded 신호 확인용 임시 스크립트
 *
 *   npx tsx -r dotenv/config src/pipeline/runextract-fadedtest.ts
 *
 * 7/25(지갑 찾은 날)를 뺀 데이터로 돌려서
 * '그냥 사라진 걱정'이 실제로 잡히는지 확인한다.
 *
 * ⚠️ 확인용이므로 원본 july-signals.json은 건드리지 않는다.
 *    확인이 끝나면 이 파일과 fixtures/july-diary-fadedtest.json은 지워도 된다.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DiaryEntry } from './preprocess';
import { extract } from './extract';
import { callSolar } from './llm';

const FIXTURES = path.join(__dirname, 'fixtures');
const INPUT = path.join(FIXTURES, 'july-diary-fadedtest.json');
const OUTPUT = path.join(FIXTURES, 'faded-test-signals.json');

function loadEntries(): DiaryEntry[] {
    if (!fs.existsSync(INPUT)) {
        console.error(`파일이 없습니다: ${INPUT}`);
        process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
    return raw.map((e: { date: string; text?: string; body?: string }) => ({
        date: e.date,
        text: e.text ?? e.body ?? '',
    }));
}

async function main() {
    const entries = loadEntries();
    console.log(`일기 ${entries.length}편 (7/25 지갑 찾은 날 제외한 테스트 데이터)`);

    const signals = await extract(entries, callSolar);

    console.log('\n─── 결과 ───');
    for (const sig of signals) {
        console.log(`\n  [${sig.category}] ${sig.date}`);
        console.log(`    "${sig.quote}"`);
        if (sig.context) console.log(`    맥락: ${sig.context.slice(0, 70)}…`);
    }

    const faded = signals.filter((s) => s.category === 'faded');
    console.log('\n─── 판정 ───');
    if (faded.length) {
        console.log(`  ✅ faded ${faded.length}개 잡힘 — 로직 정상`);
        for (const f of faded) console.log(`     "${f.quote}"`);
    } else {
        console.log('  ❌ faded 0개 — 로직 확인 필요');
    }

    fs.writeFileSync(OUTPUT, JSON.stringify(signals, null, 2), 'utf-8');
}

main().catch((e: Error) => {
    console.error('실패:', e.message);
    process.exit(1);
})