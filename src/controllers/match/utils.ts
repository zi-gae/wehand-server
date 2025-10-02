// 유틸리티 함수들

// 클라이언트에서 전달받은 축약 지역명을 공식 행정구역명으로 변환
export const convertToOfficialRegionName = (region: string): string => {
  return region
    .replace("서울 ", "서울특별시 ")
    .replace("부산 ", "부산광역시 ")
    .replace("대구 ", "대구광역시 ")
    .replace("인천 ", "인천광역시 ")
    .replace("광주 ", "광주광역시 ")
    .replace("대전 ", "대전광역시 ")
    .replace("울산 ", "울산광역시 ");
};

export function formatMatchDate(dateString: string): string {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${month}/${day}`;
}

export function formatGameType(gameType: string): string {
  const typeMap: Record<string, string> = {
    singles: "단식",
    mens_doubles: "남복",
    womens_doubles: "여복",
    mixed_doubles: "혼복",
  };
  return typeMap[gameType] || gameType;
}

export function formatNtrpLevel(minNtrp?: number, maxNtrp?: number): string {
  if (!minNtrp && !maxNtrp) return "모든 레벨";
  if (minNtrp === maxNtrp) return `${minNtrp}`;
  if (!minNtrp) return `~${maxNtrp}`;
  if (!maxNtrp) return `${minNtrp}~`;

  return `${minNtrp}~${maxNtrp}`;
}

export function formatExperienceLevel(
  minExperience?: number,
  maxExperience?: number
): string {
  if (!minExperience && !maxExperience) return "모든 구력";
  if (minExperience === maxExperience) return `${minExperience}년`;
  if (!minExperience) return `~${maxExperience}년`;
  if (!maxExperience) return `${minExperience}년~`;

  return `${minExperience}~${maxExperience}년`;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR").format(price) + "원";
}