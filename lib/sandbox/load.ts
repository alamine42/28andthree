// E8 Sandbox — fixture loader.
//
// Keep fixtures lazy: import them only when `loadFixture(key)` is called, so
// unused ones don't enter the server bundle. The aliased empty-stub path
// bypasses this file entirely in prod, so there's no accidental import.

export async function loadFixture<T>(key: string): Promise<T> {
  // Registry is built up by the stubs; each stub imports its own fixture.
  // This shim exists so external tests can access any fixture by key for
  // shape checks without a static reference graph.
  throw new Error(
    `loadFixture('${key}') — use the typed imports in lib/sandbox/fixtures/ directly; ` +
    'this shim exists only to satisfy the public-API contract with empty-stub.',
  );
}
