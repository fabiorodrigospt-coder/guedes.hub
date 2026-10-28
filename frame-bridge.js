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
    let initial = document.querySelector('[data-tab="guiado"]');
    if (!bridge.admin) {
      for (const b of document.querySelectorAll('.tabs [data-tab]')) {const module={guiado:'pedidos',producao:'producao',salgados:'salgados'}[b.dataset.tab];b.hidden=!module||!bridge.canModule(module);}initial=[...document.querySelectorAll('.tabs [data-tab]')].find(b=>!b.hidden);
      for (const s of document.querySelectorAll('body > section')) if (s.id !== 'guiado') s.hidden = true;
      document.querySelector('#ghInstallInvite')?.remove();
    }
    initial?.click();
  });
  window.addEventListener('error', e => bridge.report('Erro na área de trabalho: ' + e.message));
})();
