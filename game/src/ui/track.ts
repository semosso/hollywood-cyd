/** Eventos para o GoatCounter (sem cookies, sem identificação). Silencioso quando o script não carregou. */
type GC = { count: (opts: { path: string; title?: string; event?: boolean }) => void };

export function track(path: string, title?: string): void {
  try {
    const gc = (window as unknown as { goatcounter?: GC }).goatcounter;
    gc?.count({ path, title, event: true });
  } catch {
    /* ignore */
  }
}
