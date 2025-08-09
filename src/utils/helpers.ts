import { supabase } from "../lib/supabase";

// 날짜 유틸리티
export const formatDate = (
  date: Date | string,
  format: "date" | "datetime" | "time" = "date"
): string => {
  const d = typeof date === "string" ? new Date(date) : date;

  switch (format) {
    case "date":
      return d.toISOString().split("T")[0]; // YYYY-MM-DD
    case "time":
      return d.toTimeString().split(" ")[0].substring(0, 5); // HH:MM
    case "datetime":
      return d.toISOString();
    default:
      return d.toISOString();
  }
};

export const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

export const isFutureDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date.getTime() > Date.now();
};

// 문자열 유틸리티
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, " ");
};

export const truncateString = (str: string, length: number): string => {
  return str.length > length ? `${str.substring(0, length)}...` : str;
};

// 거리 계산 (Haversine formula)
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // 지구 반지름 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 가격 포매팅
export const formatPrice = (price: number, currency = "KRW"): string => {
  if (currency === "KRW") {
    return `${price.toLocaleString("ko-KR")}원`;
  }
  return price.toString();
};

// UUID 검증
export const isValidUUID = (str: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// 배열 유틸리티
export const uniqueBy = <T>(array: T[], key: keyof T): T[] => {
  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const value = String(item[key]);
    if (!groups[value]) {
      groups[value] = [];
    }
    groups[value].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

// Supabase 유틸리티 함수는 현재 TypeScript 타입 문제로 주석 처리
// 필요시 각 컨트롤러에서 직접 Supabase 쿼리 작성

// 에러 정보 추출
export const extractErrorInfo = (
  error: any
): { message: string; code?: string } => {
  if (error?.message) {
    return {
      message: error.message,
      code: error.code || error.error_description || "UNKNOWN_ERROR",
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return {
    message: "알 수 없는 오류가 발생했습니다",
    code: "UNKNOWN_ERROR",
  };
};

// 시간 유틸리티
export const timeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
};

export const isTimeInRange = (
  time: string,
  startTime: string,
  endTime: string
): boolean => {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
};
