(() => {
  // Anonymous visitors are not tracked: the server requires a valid session.
  const title = document.title || location.pathname.split('/').pop() || 'Home';
  fetch('/api/account/history', {
    method: 'POST', credentials: 'same-origin', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'Visited page', detail: title })
  }).catch(() => {});
})();
