/** ----- Parse positive integer with fallback. ----- **/
export function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** ----- Parse boolean from common env string values. ----- **/
export function parseBool(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/** ----- Non-empty string or undefined. ----- **/
export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

/** ----- Required non-empty string. ----- **/
export function requiredString(value: unknown, key: string): string {
  const s = optionalString(value);
  if (!s) throw new Error(`Missing required config: ${key}`);
  return s;
}
