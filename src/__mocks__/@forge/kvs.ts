import { jest } from '@jest/globals';

// Mock @forge/kvs
const store: Record<string, unknown> = {};

type BeginsWithCondition = {
  type: 'beginsWith';
  prefix: string;
};

type QueryResult<T> = {
  results: Array<{ key: string; value: T }>;
  nextCursor?: string;
};

class MockQuery {
  private prefix = '';
  private size = 100;
  private start = 0;

  where(_field: string, condition: BeginsWithCondition) {
    this.prefix = condition.prefix;
    return this;
  }

  limit(size: number) {
    this.size = size;
    return this;
  }

  cursor(cursor: string) {
    this.start = Number.parseInt(cursor, 10) || 0;
    return this;
  }

  async getMany<T>(): Promise<QueryResult<T>> {
    const entries = Object.entries(store)
      .filter(([key]) => key.startsWith(this.prefix))
      .sort(([left], [right]) => left.localeCompare(right));
    const page = entries.slice(this.start, this.start + this.size);
    const nextStart = this.start + this.size;

    return {
      results: page.map(([key, value]) => ({
        key,
        value: value as T,
      })),
      nextCursor: nextStart < entries.length ? String(nextStart) : undefined,
    };
  }
}

export const WhereConditions = {
  beginsWith(prefix: string): BeginsWithCondition {
    return { type: 'beginsWith', prefix };
  },
};

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
  query: jest.fn(() => new MockQuery()),
  _reset: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  _store: store,
};
