import type { MotReading } from "@/lib/vault-store";

export function sortMotTests<T extends Pick<MotReading, "date" | "result">>(tests: readonly T[]): T[] {
  return tests
    .map((test, index) => ({ test, index }))
    .sort((a, b) => {
      const dateOrder = b.test.date.slice(0, 10).localeCompare(a.test.date.slice(0, 10));
      if (dateOrder !== 0) return dateOrder;

      const aIsPass = /^pass\b/i.test(a.test.result);
      const bIsPass = /^pass\b/i.test(b.test.result);
      if (aIsPass !== bIsPass) return aIsPass ? 1 : -1;

      return a.index - b.index;
    })
    .map(({ test }) => test);
}
