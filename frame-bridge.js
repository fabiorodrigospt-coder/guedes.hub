'use strict';
(() => {
  if (window.parent === window || !window.parent.GHCloud?.ready) {
    location.replace('./');
    throw new Error('Abra o aplicativo pelo acesso autenticado.');
  }
  const bridge = window.parent.GHCloud;
  const storage = {
    get length() { return bridge.keys().length; },
    key: index => bridge.keys()[index] ?? null,
    getItem: key => bridge.get(String(key)),
    setItem: (key, value) => bridge.set(String(key), String(value)),
    removeItem: key => bridge.set(String(key), null),
    clear: () => { throw new Error('Exclusão global não permitida. Exporte o backup.'); }
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: false });
  window.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('input', () => bridge.dirty(), true);
    document.documentElement.style.visibility='visible';
    const guiado = document.querySelector('[data-tab="guiado"]');
    if (!bridge.admin) {
      for (const b of document.querySelectorAll('.tabs [data-tab]')) if (b.dataset.tab !== 'guiado') b.hidden = true;
      for (const s of document.querySelectorAll('body > section')) if (s.id !== 'guiado') s.hidden = true;
      document.querySelector('#ghInstallInvite')?.remove();
    }
    guiado?.click();
  });
  window.addEventListener('error', e => bridge.report('Erro na área de trabalho: ' + e.message));
})();
