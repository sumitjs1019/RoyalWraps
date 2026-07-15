(() => {
  'use strict';

  const results = document.getElementById('orderResults');
  if (!results || document.body.dataset.orderMode !== 'list') return;

  function simplifyMyOrders() {
    results.querySelectorAll('.order-progress').forEach((progress) => progress.remove());

    results.querySelectorAll('.action-button.primary').forEach((button) => {
      if (button.textContent.trim().toLowerCase() === 'track package') {
        button.textContent = 'Track Order';
        button.setAttribute('aria-label', 'Track Order');
      }
    });
  }

  const observer = new MutationObserver(simplifyMyOrders);
  observer.observe(results, { childList: true, subtree: true });
  simplifyMyOrders();
})();
