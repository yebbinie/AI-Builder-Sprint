// src/pipeline/assemble.ts
import { ExtractedSignal } from './types';
import { LetterParagraph, LetterSegment } from '../types';

const UPSTAGE_API_KEY = process.env.EXPO_PUBLIC_UPSTAGE_API_KEY;

const CLOSING_LINE = '다음 달의 너는 이걸 잊고 있을 텐데, 그래도 한 번은 읽어줬으면 좋겠다.';

const SYSTEM_PROMPT = `당신은 지난달의 "나"가 되어 다음 달의 나에게 편지를 씁니다.
이 편지는 AI가 분석해서 알려주는 리포트가 아니라, 그 사람이 직접 쓴 편지처럼 읽혀야 합니다.

# 절대 지켜야 할 핵심 규칙 3 — 인용 앞에서 내용을 미리 설명하지 마세요
{{Q:ID}} 바로 앞 문장에서 그 인용이 무슨 내용인지 미리 요약하거나 재진술하지 마세요.
잘못된 예: "엄마가 옥수수 삶아준 저녁이 있었어. 그게 여름이지…… {{Q:07-01a}}" (앞 문장이 인용 내용을 미리 말해버림)
올바른 예: "{{Q:07-01a}}는 말이 아직도 생각나." 또는 "엄마가 저녁에 해준 게 있었지, {{Q:07-01a}}"
인용 앞에는 그 인용과 겹치지 않는 다른 맥락(장소, 감정, 다른 사건과의 연결)만 짧게 두세요.
인용 뒤에서 감상을 붙이는 건 괜찮습니다.

# 형식
- 반말. 존댓말 절대 금지
- 인사로 시작 → 회상으로 이어지는 글
- 문단은 3~6개, 자연스럽게 이어지는 글
- 마무리 인사는 당신이 쓰지 않아도 됩니다. 편지 본문(인용을 담은 문단들)만 작성하세요.

# 절대 쓰면 안 되는 표현
- 평가·칭찬: 대단하다, 훌륭하다, 잘했다, 자랑스럽다
- 조언·제안: ~해보자, ~하면 좋겠다, 다음 달엔 ~하길, ~하길 바라, ~하기를, ~기억해 두면, ~잊지 않았으면
- 집계 어투: N번 썼다, N일 중 N일, 빈도가 높다
- 진단·분석 어투: ~로 보인다, ~한 경향이 있다, 패턴이 나타난다
- 자기비판: 왜 이것밖에, 또, 여전히, 항상(부정 맥락)
- "~좋겠다", "~바란다" 계열 문장은 아예 쓰지 마세요

# 절대 지켜야 할 핵심 규칙 1 — 날짜 순서 나열 금지
가장 흔하고 가장 나쁜 실패는 "1일엔 이랬고, 6일엔 이랬고, 11일엔 이랬고..."처럼
날짜 순서대로 하나씩 요약해서 나열하는 것입니다. 이건 일기 요약이지 편지가 아닙니다.

대신 이렇게 쓰세요:
- 문단을 "그날 무슨 일이 있었는지"가 아니라 "그 인용이 어떤 감정/주제를 담고 있는지"로 묶으세요
- 날짜나 "몇 일에"를 문장에 직접 언급하지 마세요 (예: "13일에", "27일에" 같은 표현 쓰지 말 것)
- 인용 하나당 문단 하나씩 기계적으로 배정하지 말고, 감정이나 흐름이 통하는 인용끼리는 한 문단에 자연스럽게 엮으세요

# 절대 지켜야 할 핵심 규칙 2 — 문장 다양성
1. "~라고 적어놨더라"를 반복해서 쓰지 마세요. 인용을 연결하는 표현을 문단마다 다르게 쓰세요.
   예: "~라고 자주 썼는데", "~는 말은 참 여러 번 썼더라", "~로 끝냈더라", "~을 보니", "~라던데", 아예 연결어 없이 인용을 문장 맨 앞이나 중간에 바로 놓기.
   같은 연결 표현을 편지 안에서 두 번 이상 반복하지 마세요.
2. "그때는 ~였는데, 지금은 ~"라는 대구 구조는 편지 전체에서 최대 1번만 쓰세요.
3. 앞 문장에서 이미 쓴 단어를 그 문장 바로 뒤의 인용과 겹치게 쓰지 마세요.
4. 감상은 과하지 않게. "정말 다행이었어" 대신 "다행이네" 정도의 담백한 톤을 유지하세요.

# resolved 카테고리 특별 규칙
- resolved 카테고리 신호는 quote(해결된 순간의 문장)와 context(처음 걱정하던 문장)를 함께 받습니다
- 두 문장을 대비시키되, context 문장을 그대로 인용하지 마세요. 당신의 말로 요약만 하세요
- context에는 별도의 {{Q:ID}} 표시를 쓰지 마세요 — context는 quote 하나에 딸린 참고 정보일 뿐입니다

# 인용 규칙 (매우 중요, 반드시 지킬 것)
아래 신호 목록의 각 항목에는 고유 ID가 붙어 있습니다 (예: ID:07-06a). 그 신호를 인용할 자리에는
반드시 그 ID를 그대로 써서 **{{Q:ID}}** 형태로 표시하세요.

- 절대로 quote 문장을 직접 타이핑하지 마세요. {{Q:ID}} 표시 하나로 대신합니다. 원문을 쓰고 그 뒤에 {{Q:ID}}를 또 붙이는 것도 금지입니다 — 표시 하나만 있으면 됩니다
- {{Q:ID}} 앞뒤에 그 인용의 원문 단어를 다시 쓰지 마세요
- "적지 않았다", "말하지 않았다" 같이 인용의 존재를 부정하는 서술 금지
- ID는 신호 목록에 적힌 그대로 정확히 복사해서 쓰세요. 신호 목록에 있는 ID 개수만큼만 쓰세요. 목록에 없는 ID를 만들어내지 마세요

# 출력 형식
반드시 JSON만 출력하세요. 다른 텍스트, 설명, 코드블록 표시 없이 순수 JSON만.
{
  "paragraphs": ["문단1 텍스트, {{Q:07-06a}} 표시 포함 가능", "문단2 텍스트..."]
}`;

interface SignalWithId {
  id: string;
  signal: ExtractedSignal;
}

function assignSignalIds(signals: ExtractedSignal[]): SignalWithId[] {
  const dateCounts: Record<string, number> = {};
  return signals.map((signal) => {
    const shortDate = signal.date.slice(5); // 'MM-DD'
    const idx = dateCounts[signal.date] ?? 0;
    dateCounts[signal.date] = idx + 1;
    const suffix = String.fromCharCode(97 + idx); // a, b, c...
    return { id: `${shortDate}${suffix}`, signal };
  });
}

function buildUserPrompt(signalsWithId: SignalWithId[], monthLabel: string): string {
  const categoryLabel: Record<string, string> = {
    repeated: '반복해서 나온 감정',
    faded: '전반부엔 있었는데 후반부에 그냥 사라진 얘기 (해결됐다는 언급 없이 그냥 안 씀)',
    resolved: '전반부에 걱정하던 게 후반부에 실제로 해결되는 문장이 있는 경우',
    good_day: '좋았던 날, 웃겼던 날, 별거 없던 평범한 날 (힘든 얘기만 나열되지 않게 균형을 맞추는 용도)',
    unspoken_effort: '실제로 일기에 적혀 있는, 담담하게 쓴 노력·성취 (이 사람이 대수롭지 않게 여겼을 뿐, 분명히 일기에 쓴 문장임)',
  };
  const signalList = signalsWithId
    .map(({ id, signal }) => {
      const contextNote = signal.context ? ` [참고 맥락: "${signal.context}"]` : '';
      return `ID:${id} [${categoryLabel[signal.category] ?? signal.category}] (${signal.date}): "${signal.quote}"${contextNote}`;
    })
    .join('\n');
  return `${monthLabel}의 신호 목록:\n${signalList}\n\n이 신호들로 편지 본문을 조립해줘 (마무리 인사는 안 써도 돼, 본문만). 날짜 순서대로 나열하지 말고, 감정이나 주제로 자연스럽게 엮어줘. 인용 자리엔 반드시 {{Q:ID}} 형태로, 위에 적힌 ID 그대로 써줘. 반드시 JSON으로만 답해줘.`;
}

function stripDuplicatedQuoteText(segments: LetterSegment[]): LetterSegment[] {
  const result: LetterSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type !== 'quote') {
      result.push({ ...seg });
      continue;
    }
    const prev = result[result.length - 1];
    if (prev && prev.type === 'text') {
      const trimmed = prev.content.trimEnd();
      if (trimmed.endsWith(seg.content)) {
        prev.content = trimmed.slice(0, trimmed.length - seg.content.length);
      }
    }
    result.push({ ...seg });
    const next = segments[i + 1];
    if (next && next.type === 'text') {
      const trimmed = next.content.trimStart();
      if (trimmed.startsWith(seg.content)) {
        segments[i + 1] = { ...next, content: trimmed.slice(seg.content.length) };
      }
    }
  }
  return result;
}

function parseParagraph(text: string, signalsWithId: SignalWithId[]): LetterSegment[] {
  const segments: LetterSegment[] = [];
  const regex = /\{\{Q:([\w-]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    const id = match[1];
    const found = signalsWithId.find((s) => s.id === id);
    if (found) {
      segments.push({ type: 'quote', content: found.signal.quote, date: found.signal.date });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return segments;
}

function countDateMentions(text: string): number {
  const matches = text.match(/\d{1,2}일/g);
  return matches ? matches.length : 0;
}

export async function assembleLetter(
  signals: ExtractedSignal[],
  monthLabel: string,
  attempt: number = 1
): Promise<{ paragraphs: LetterParagraph[]; signature: string }> {
  console.log(`[assembleLetter 시작] attempt=${attempt}`);
  if (!UPSTAGE_API_KEY) {
    throw new Error('EXPO_PUBLIC_UPSTAGE_API_KEY가 .env에 설정되어 있지 않습니다.');
  }

  const signalsWithId = assignSignalIds(signals);

  const response = await fetch('https://api.upstage.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${UPSTAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'solar-pro3',
      temperature: 0.5,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(signalsWithId, monthLabel) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Upstage API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content ?? '';
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  let parsed: { paragraphs: string[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.log(`--- 시도 ${attempt} 원본 응답 (JSON 파싱 실패) ---`);
    console.log(rawText);
    console.log('---');
    if (attempt >= 8) {
      throw new Error('JSON 파싱이 8번 시도 후에도 계속 실패했습니다.');
    }
    console.warn(`JSON 파싱 실패 — 재시도 ${attempt + 1}번째`);
    return assembleLetter(signals, monthLabel, attempt + 1);
  }

  console.log(`--- 시도 ${attempt} 원본 응답 ---`);
  console.log(rawText);
  console.log('---');

  const monthNumber = monthLabel.match(/(\d+)월/)?.[1];
  const signature = monthNumber ? `— ${monthNumber}월의 나로부터` : '— 지난달의 나로부터';

  const paragraphs = parsed.paragraphs.map((text) => ({
    segments: stripDuplicatedQuoteText(parseParagraph(text, signalsWithId)),
  }));

  // 검증 1: 모든 신호(quote)가 정확히 한 번씩 편지에 등장하는가
  const usedQuotes = paragraphs.flatMap((p) =>
    p.segments.filter((s) => s.type === 'quote').map((s) => s.content)
  );
  const missingQuotes = signals.filter((s) => !usedQuotes.includes(s.quote)).map((s) => s.quote);
  const extraQuoteCount = usedQuotes.length !== signals.length;

  // 검증 2: 원문이 표시 앞뒤에 중복으로 남아있는가
  const hasDuplicatedQuoteText = paragraphs.some((p) =>
    p.segments.some(
      (seg) => seg.type === 'text' && signals.some((s) => seg.content.includes(s.quote))
    )
  );

  // 검증 3: 문단끼리 이어주는 텍스트가 통째로 똑같은가
  const paragraphTexts = paragraphs.map((p) =>
    p.segments
      .filter((s) => s.type === 'text')
      .map((s) => s.content)
      .join('')
      .trim()
  );
  const hasDuplicatedParagraphText = paragraphTexts.some(
    (text, i) => text.length > 5 && paragraphTexts.indexOf(text) !== i
  );

  // 검증 4: 조언성 표현이 있는가
  const bannedPhrases = ['하면 좋겠다', '좋았으면', '잊지 않았으면', '기억해 두면', '해보자'];
  const paragraphFullTexts = paragraphs.map((p) => p.segments.map((s) => s.content).join(''));
  const hasBannedPhrase = paragraphFullTexts.some((text) =>
    bannedPhrases.some((phrase) => text.includes(phrase))
  );

  // 검증 5: "적어놨더라"가 반복해서 나오는가
  const jeokeonatdaCount = paragraphFullTexts.filter((text) => text.includes('적어놨더라')).length;
  const tooRepetitiveConnector = jeokeonatdaCount >= 3;

  // 검증 6: "그때는" + "지금은" 대구 구조가 2번 이상 나오는가
  const thenNowCount = paragraphFullTexts.filter(
    (text) => text.includes('그때는') && text.includes('지금은')
  ).length;
  const tooRepetitiveThenNow = thenNowCount >= 2;

  // 검증 7: "N일" 형태로 날짜를 직접 언급하는 문장이 너무 많은가
  const totalDateMentions = paragraphFullTexts.reduce((sum, text) => sum + countDateMentions(text), 0);
  const tooManyDateMentions = totalDateMentions >= 3;

  const isValid =
    missingQuotes.length === 0 &&
    !extraQuoteCount &&
    !hasDuplicatedQuoteText &&
    !hasDuplicatedParagraphText &&
    !hasBannedPhrase &&
    !tooRepetitiveConnector &&
    !tooRepetitiveThenNow &&
    !tooManyDateMentions;

  if (!isValid) {
    if (attempt >= 8) {
      throw new Error(
        `조립 검증 실패 (누락: ${missingQuotes.join(' / ') || '없음'}, 개수불일치: ${extraQuoteCount}, 중복텍스트: ${hasDuplicatedQuoteText}, 문단중복: ${hasDuplicatedParagraphText}, 금지표현: ${hasBannedPhrase}, 연결어반복: ${tooRepetitiveConnector}, 대구반복: ${tooRepetitiveThenNow}, 날짜나열: ${tooManyDateMentions}). 8번 시도 후 실패.`
      );
    }
    console.warn(
      `검증 실패 감지 (누락: ${missingQuotes.length}, 개수불일치: ${extraQuoteCount}, 중복텍스트: ${hasDuplicatedQuoteText}, 문단중복: ${hasDuplicatedParagraphText}, 금지표현: ${hasBannedPhrase}, 연결어반복: ${tooRepetitiveConnector}, 대구반복: ${tooRepetitiveThenNow}, 날짜나열: ${tooManyDateMentions}) — 재시도 ${attempt + 1}번째`
    );
    return assembleLetter(signals, monthLabel, attempt + 1);
  }

  // 마무리 문단은 모델에게 맡기지 않고 코드에서 고정으로 붙임 — 안정성 확보
  const paragraphsWithClosing: LetterParagraph[] = [
    ...paragraphs,
    { segments: [{ type: 'text', content: CLOSING_LINE }] },
  ];

  return { paragraphs: paragraphsWithClosing, signature };
}