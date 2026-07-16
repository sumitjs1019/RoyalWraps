(() => {
  const checkoutForm = document.getElementById('checkoutForm');
  if (!checkoutForm || typeof checkoutForm.reset !== 'function') return;

  const nativeReset = checkoutForm.reset.bind(checkoutForm);

  checkoutForm.reset = function resetAndOpenMyOrders() {
    nativeReset();

    let paidOrder = null;
    try {
      paidOrder = JSON.parse(sessionStorage.getItem('royalwrap-order') || 'null');
    } catch {}

    const paidAt = Date.parse(paidOrder?.paidAt || '');
    const paymentJustCompleted = Number.isFinite(paidAt) && Date.now() - paidAt < 120000;

    if (!paymentJustCompleted) return;

    window.location.replace('/my-orders.html');

    // Stop the old app.js success-page assignment from running after navigation starts.
    throw new Error('Opening My Orders...');
  };
})();
