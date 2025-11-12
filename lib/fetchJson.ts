export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${error}`);
  }
  return res.json();
}

