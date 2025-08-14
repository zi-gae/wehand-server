export function safeJsonParse(str: string): object | string {
  try {
    const parsed = JSON.parse(str);
    // 객체 형태일 때만 반환
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return str;
  } catch {
    // 파싱 실패 시 원본 문자열 반환
    return str;
  }
}
