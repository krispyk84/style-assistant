/**
 * Runs `worker` over `items` with at most `limit` calls truly in flight at
 * once — unlike a fixed stagger (which only spaces out START times), this
 * bounds actual overlap: if a worker takes longer than the stagger interval
 * to complete, a stagger alone lets every item end up running concurrently
 * anyway. Used for memory-heavy fire-and-forget work (AI image generation)
 * where too much real concurrency risks exceeding the server's memory limit.
 */
export async function runWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;

  async function runNext(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    await worker(items[index]!, index);
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
}
