// Mock @forge/resolver
class Resolver {
  private handlers: Record<string, (ctx: { payload: unknown }) => unknown> = {};

  define(name: string, handler: (ctx: { payload: unknown }) => unknown) {
    this.handlers[name] = handler;
  }

  getDefinitions() {
    return this.handlers;
  }
}

export default Resolver;
