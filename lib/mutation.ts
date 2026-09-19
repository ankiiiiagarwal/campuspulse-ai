import { AsyncLocalStorage } from "node:async_hooks";

// Shared across Next route bundles. Local mode is a single-server development store.
const state = globalThis as typeof globalThis & {
  cpMutation?: { tail: Promise<unknown>; context: AsyncLocalStorage<boolean> };
};
const lock = state.cpMutation ??= { tail: Promise.resolve(), context: new AsyncLocalStorage<boolean>() };

export class WriteConflict extends Error {}

export async function mutate<T>(operation: () => Promise<T>): Promise<T> {
  if (lock.context.getStore()) return operation();
  const result = lock.tail.then(() => lock.context.run(true, async () => {
    for (let attempt = 0; ; attempt++) {
      try { return await operation(); }
      catch (error) {
        if (!(error instanceof WriteConflict) || attempt >= 7) throw error;
      }
    }
  }));
  lock.tail = result.catch(() => undefined);
  return result;
}
