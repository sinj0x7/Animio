export type ParsedWatchUrl =
  | { kind: 'kai'; kaiId: string; epId?: string }
  | { kind: 'al'; alId: number; epId?: string; kid?: string };

export function parseWatchFromSearch(): ParsedWatchUrl | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  const watch = p.get('watch');
  if (watch === 'kai') {
    const id = p.get('id');
    if (!id) return null;
    return { kind: 'kai', kaiId: id, epId: p.get('ep') ?? undefined };
  }
  if (watch === 'al') {
    const al = p.get('al');
    if (!al) return null;
    const alId = parseInt(al, 10);
    if (!Number.isFinite(alId)) return null;
    return {
      kind: 'al',
      alId,
      epId: p.get('ep') ?? undefined,
      kid: p.get('kid') ?? undefined,
    };
  }
  return null;
}

export function replaceWatchUrl(
  params:
    | { kind: 'kai'; kaiId: string; epId?: string }
    | { kind: 'al'; alId: number; epId?: string; kid?: string },
) {
  const u = new URL(window.location.href);
  u.search = '';
  if (params.kind === 'kai') {
    u.searchParams.set('watch', 'kai');
    u.searchParams.set('id', params.kaiId);
    if (params.epId) u.searchParams.set('ep', params.epId);
  } else {
    u.searchParams.set('watch', 'al');
    u.searchParams.set('al', String(params.alId));
    if (params.epId) u.searchParams.set('ep', params.epId);
    if (params.kid) u.searchParams.set('kid', params.kid);
  }
  history.replaceState(history.state ?? {}, '', u);
}
