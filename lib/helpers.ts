export function parseOffsets(): number[] {
  const offsetsStr = process.env.REMINDER_OFFSETS || '-30,-7,-3,-1,1';
  return offsetsStr
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

