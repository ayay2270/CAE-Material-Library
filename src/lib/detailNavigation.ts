export const MATERIAL_QUERY = 'material';

export function materialIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(MATERIAL_QUERY);
  const trimmed = id?.trim();
  return trimmed ? trimmed : null;
}

/** Keeps unrelated query parameters, including the isolated example flag. */
export function searchWithMaterial(search: string, id: string | null): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (id) params.set(MATERIAL_QUERY, id);
  else params.delete(MATERIAL_QUERY);
  const text = params.toString();
  return text ? `?${text}` : '';
}
