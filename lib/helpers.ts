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

// Convert DD-MM-YY format to YYYY-MM-DD
export function convertDateFormat(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '' || dateStr.toLowerCase() === 'not applicable') {
    return '';
  }
  
  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try DD-MM-YY format
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2].trim();
    
    // Convert 2-digit year to 4-digit (assuming 20xx for years < 50, 19xx otherwise)
    if (year.length === 2) {
      const yearNum = parseInt(year, 10);
      year = yearNum < 50 ? `20${year}` : `19${year}`;
    }
    
    return `${year}-${month}-${day}`;
  }
  
  throw new Error(`Invalid date format: ${dateStr}`);
}

// Check if a value is "Not Applicable" or empty
export function isNotApplicable(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'not applicable' || normalized === 'n/a';
}





