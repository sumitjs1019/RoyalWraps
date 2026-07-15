(() => {
  'use strict';

  const results = document.getElementById('orderResults');
  if (!results || document.body.dataset.orderMode !== 'list') return;

  function paymentMethodFromCard(card) {
    const paymentBox = Array.from(card.querySelectorAll('.detail-box')).find((box) => {
      return box.querySelector('span')?.textContent.trim().toLowerCase() === 'payment method';
    });
    return paymentBox?.querySelector('strong')?.textContent.trim() || 'Not available';
  }

  function createPaymentModeNote(paymentMethod) {
    const note = document.createElement('div');
    note.className = 'delivery-note payment-mode-note';
    note.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18M7 15h4"></path></svg><span></span>';
    note.querySelector('span').textContent = `Payment mode: ${paymentMethod}`;
    return note;
  }

  function showPaymentMode(card) {
    const details = card.querySelector('.order-details');
    if (!details) return;

    const paymentMethod = paymentMethodFromCard(card);
    card.querySelectorAll('.delivery-note:not(.payment-mode-note)').forEach((addressNote) => {
      addressNote.insertAdjacentElement('afterend', createPaymentModeNote(paymentMethod));
    });

    details.remove();
  }

  function simplifyMyOrders() {
    results.querySelectorAll('.order-card').forEach(showPaymentMode);
    results.querySelectorAll('.order-progress').forEach((progress) => progress.remove());
    results.querySelectorAll('.product-actions').forEach((actions) => actions.remove());
    results.querySelectorAll('a[href*="track-order"]').forEach((link) => link.remove());
    results.querySelectorAll('.order-details').forEach((details) => details.remove());
  }

  const observer = new MutationObserver(simplifyMyOrders);
  observer.observe(results, { childList: true, subtree: true });
  simplifyMyOrders();
})();
