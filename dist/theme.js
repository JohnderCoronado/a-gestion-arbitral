(() => {
  'use strict';

  const storageKey = 'a-interface-theme';
  const root = document.documentElement;
  const get = () => root.dataset.theme === 'light' ? 'light' : 'dark';

  function apply(value) {
    const theme = value === 'light' ? 'light' : 'dark';
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101722' : '#f5f6f8');
  }

  let initial = 'dark';
  try {
    initial = localStorage.getItem(storageKey) || initial;
  } catch {
    // The visual preference still works for this session when storage is unavailable.
  }
  apply(initial);

  window.ATheme = Object.freeze({
    get,
    toggle() {
      apply(get() === 'dark' ? 'light' : 'dark');
      try {
        localStorage.setItem(storageKey, get());
        return true;
      } catch {
        return false;
      }
    }
  });
})();
