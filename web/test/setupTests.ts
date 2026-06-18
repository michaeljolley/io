import { JSDOM } from "jsdom";

// Create a JSDOM window/document if none exists
if (typeof globalThis.window === "undefined" || typeof globalThis.document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  // @ts-ignore
  globalThis.window = dom.window;
  // @ts-ignore
  globalThis.document = dom.window.document;
  // copy other useful globals
  // @ts-ignore
  globalThis.HTMLElement = dom.window.HTMLElement;
  // @ts-ignore
  globalThis.Node = dom.window.Node;
}

// Provide a minimal localStorage shim for tests
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => (k in storage ? storage[k] : null),
  setItem: (k: string, v: string) => (storage[k] = String(v)),
  removeItem: (k: string) => delete storage[k],
  clear: () => Object.keys(storage).forEach((k) => delete storage[k]),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: false,
});

// Ensure requestAnimationFrame exists in the test environment
if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
