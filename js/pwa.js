// ===== PWA: service worker, instalação, botão Voltar e atalhos =====
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
  }
  // Pede ao Android para não apagar os dados salvos por falta de espaço
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // Instalação
  const CH = 'gestao_pwa_banner_dispensado';
  let evt = null;
  const banner = () => document.getElementById('install-banner');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); evt = e;
    try { if (localStorage.getItem(CH)) return; } catch (_) {}
    banner() && banner().classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => banner() && banner().classList.add('hidden'));
  window.instalarApp = async function () {
    if (!evt) return;
    evt.prompt(); await evt.userChoice; evt = null;
    banner().classList.add('hidden');
  };
  window.dispensarInstalacao = function () {
    try { localStorage.setItem(CH, '1'); } catch (_) {}
    banner().classList.add('hidden');
  };

  // Botão Voltar do Android fecha a janela aberta em vez de sair do app
  const sel = 'div[id^="modal-"]';
  let aberto = false;
  const obs = new MutationObserver(() => {
    const agora = !!document.querySelector(sel + ':not(.hidden)');
    if (agora && !aberto) history.pushState({ modal: 1 }, '');
    else if (!agora && aberto && history.state && history.state.modal) history.back();
    aberto = agora;
  });
  window.addEventListener('DOMContentLoaded', () =>
    document.querySelectorAll(sel).forEach(m => obs.observe(m, { attributes: true, attributeFilter: ['class'] })));
  window.addEventListener('popstate', () =>
    document.querySelectorAll(sel).forEach(m => m.classList.add('hidden')));

  // Atalhos do ícone (toque longo): ?acao=recebimento | despesa
  window.addEventListener('load', () => {
    const a = new URLSearchParams(location.search).get('acao');
    if (a === 'recebimento') abrirModalRecebimento();
    if (a === 'despesa') abrirModalDespesa();
  });
})();
