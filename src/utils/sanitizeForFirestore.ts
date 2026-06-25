export function sanitizeForFirestore<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    value === undefined ? null : value
  )) as T;
}
