// Mock @forge/kvs
const store: Record<string, unknown> = {};

export const kvs = {
  get: jest.fn(async <T>(key: string): Promise<T | null> => {
    return (store[key] as T) ?? null;
  }),
  set: jest.fn(async (key: string, value: unknown): Promise<void> => {
    store[key] = value;
  }),
  delete: jest.fn(async (key: string): Promise<void> => {
    delete store[key];
  }),
  _reset: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  _store: store,
};
