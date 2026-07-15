(() => {
  'use strict';

  const results = document.getElementById('orderResults');
  if (!results || document.body.dataset.orderMode !== 'list') return;

  function simplifyMyOrders() {
    results.querySelectorAll('.order-progress').forEach((progress) => progress.remove());
    results.querySelectorAll('.product-actions').forEach((actions) => actions.remove());
    results.querySelectorAll('a[href*="track-order"]').forEach((link) => link.remove());
  }

  const observer = new MutationObserver(simplifyMyOrders);
  observer.observe(results, { childList: true, subtree: true });
  simplifyMyOrders();
})();