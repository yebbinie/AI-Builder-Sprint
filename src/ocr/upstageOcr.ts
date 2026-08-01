const UPSTAGE_API_KEY = process.env.EXPO_PUBLIC_UPSTAGE_API_KEY;

export async function parseImageToText(imageUri: string): Promise<string> {
  if (!UPSTAGE_API_KEY) {
    throw new Error('EXPO_PUBLIC_UPSTAGE_API_KEY가 .env에 설정되어 있지 않습니다.');
  }

  const filename = imageUri.split('/').pop() ?? 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const formData = new FormData();
  // React Native의 FormData는 웹과 달리 { uri, name, type } 객체를 그대로 넣는다.
  formData.append('document', {
    uri: imageUri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);
  formData.append('model', 'document-parse');
  formData.append('ocr', 'force');

  const response = await fetch('https://api.upstage.ai/v1/document-digitization', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTAGE_API_KEY}`,
      // Content-Type은 FormData가 boundary를 포함해서 자동으로 설정하므로 직접 넣지 않는다.
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upstage OCR 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  let text: string = data?.content?.text ?? '';

  // text 필드가 비어있으면 html에서 태그를 제거해서 사용
  if (!text.trim() && data?.content?.html) {
    text = data.content.html
      .replace(/<br\s*\/?>/gi, '\n')       // <br>을 줄바꿈으로
      .replace(/<\/p>/gi, '\n')             // 문단 끝에 줄바꿈
      .replace(/<[^>]+>/g, '')              // 나머지 태그 전부 제거
      .replace(/\n{2,}/g, '\n')             // 연속 줄바꿈 정리
      .trim();
  }

  if (!text.trim()) {
    throw new Error('사진에서 텍스트를 인식하지 못했습니다.');
  }

  return text.trim();
}