// Node.js module loader that turns CSS imports into no-ops.
// Used so markdown.ts (which imports highlight.js CSS) can be tested in Node.js.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.css')) {
    return { shortCircuit: true, url: 'data:text/javascript,' }
  }
  return nextResolve(specifier, context)
}
