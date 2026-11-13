(() => {
  const form = document.getElementById('reviewForm');
  const status = document.getElementById('status');
  if (!form || !status) return;

  // This capture handler replaces the older 2 MB client-side guard. Images
  // are still limited to safe, supported image formats by the server.
  form.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const file = document.getElementById('photo')?.files?.[0];
    const photoData = file ? await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('The photo could not be read. Please choose it again.'));
      reader.readAsDataURL(file);
    }) : '';
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: document.getElementById('type').value,
          targetName: document.getElementById('name').value,
          rating: Number(document.getElementById('rating').value),
          message: document.getElementById('message').value,
          photoData
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to publish review.');
      status.textContent = data.message || 'Review published.';
      form.reset();
      location.reload();
    } catch (error) {
      status.textContent = error.message || 'Unable to publish review.';
    }
  }, true);
})();
