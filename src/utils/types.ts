// snake_case 문자열을 camelCase로 변환하는 타입
export type SnakeToCamelCase<S extends string> =
  S extends `${infer T}_${infer U}`
    ? `${Lowercase<T>}${Capitalize<SnakeToCamelCase<U>>}`
    : Lowercase<S>;

// 객체의 키를 snake_case에서 camelCase로 변환하는 타입
export type KeysToCamelCase<T> = T extends unknown[]
  ? KeysToCamelCase<T[number]>[]
  : T extends object
  ? {
      [K in keyof T as K extends string
        ? SnakeToCamelCase<K>
        : K]: KeysToCamelCase<T[K]>;
    }
  : T;
