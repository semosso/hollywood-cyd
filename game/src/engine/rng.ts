/** Toda aleatoriedade do jogo passa por aqui. Nenhum Math.random fora deste arquivo. */

export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = {
  /** U[0,1) */
  next(): number;
  /** inteiro em [0, n) */
  int(n: number): number;
  /** U[a,b) */
  range(a: number, b: number): number;
  /** escolha ponderada; pesos ≥ 0 */
  weighted<T>(items: T[], weight: (t: T) => number): T | undefined;
  pick<T>(items: T[]): T | undefined;
  shuffle<T>(items: T[]): T[];
};

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (n) => Math.floor(next() * n),
    range: (lo, hi) => lo + next() * (hi - lo),
    weighted(items, weight) {
      const ws = items.map((i) => Math.max(0, weight(i)));
      const total = ws.reduce((s, w) => s + w, 0);
      if (total <= 0) return undefined;
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= ws[i];
        if (r < 0) return items[i];
      }
      return items[items.length - 1];
    },
    pick: (items) => (items.length ? items[Math.floor(next() * items.length)] : undefined),
    shuffle(items) {
      const a = items.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
  return rng;
}

/** PRNG derivado e estável: mesma seed + mesmas chaves = mesma sequência. */
export function rngFor(seed: string, ...keys: (string | number)[]): Rng {
  return mulberry32(fnv1a(seed + "|" + keys.join("|")));
}

export function randomSeed(): string {
  const words = ["sunset", "marmont", "oscar", "razzie", "mulholland", "viper", "studio", "backlot", "trailer", "premiere", "tabloid", "sequel"];
  const n = Date.now() % 100000;
  return `${words[n % words.length]}-${words[(n * 7) % words.length]}-${n}`;
}
