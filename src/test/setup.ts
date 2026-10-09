import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom implements no layout, so it ships no ResizeObserver. `components/ui/table`
// uses one to decide whether to show its horizontal-scroll affordance, which makes
// any test that renders a DataTable throw on mount. A no-op observer is the right
// stub: there is nothing to observe without layout.
if (!("ResizeObserver" in globalThis)) {
  class NoopResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = NoopResizeObserver;
}

// Same root cause, different API: with no layout engine jsdom ships no scrollIntoView and
// no pointer-capture methods. Radix Select calls scrollIntoView on the highlighted option
// when its listbox opens, and probes pointer capture while dragging. The throw lands in a
// passive effect, so React unmounts the whole tree and the test sees an empty document with
// a confusing "unable to find role button" failure rather than the real error. Any test that
// picks an option from a <Select> needs these.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCapture() {
    return false;
  };
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = function releasePointerCapture() {};
}
