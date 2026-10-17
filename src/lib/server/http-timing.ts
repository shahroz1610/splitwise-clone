import "server-only";

/** Await `work`, logging how long it took. Prefix `[timing]` makes the logs easy to grep. */
export async function timed<T>(label: string, work: PromiseLike<T>): Promise<T> {
  const start = performance.now();
  try {
    return await work;
  } finally {
    console.log(`[timing] ${label} ${(performance.now() - start).toFixed(0)}ms`);
  }
}
