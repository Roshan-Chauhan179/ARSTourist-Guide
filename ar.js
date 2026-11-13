(() => {
  const esc = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
  const video = document.getElementById('camera'); const status = document.getElementById('cameraStatus'); const landmarks = document.getElementById('landmarks'); const frame = document.getElementById('cameraFrame'); const startButton = document.getElementById('start');
  document.getElementById('start').onclick = async () => {
    const destination = document.getElementById('destination').value.trim(); if (!destination) { document.getElementById('destination').focus(); return; }
    landmarks.innerHTML = '<p>Finding nearby landmarks…</p>'; status.textContent = 'Finding nearby landmarks and requesting camera access…'; frame?.classList.add('is-loading'); startButton.disabled = true; startButton.innerHTML = 'Starting guide…';
    try {
      const response = await fetch(`/api/places?destination=${encodeURIComponent(destination)}`); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load nearby landmarks.');
      landmarks.innerHTML = `<h3>Nearby landmarks around ${esc(data.location)}</h3>${data.items.map(item => `<p>📍 <strong>${esc(item.name)}</strong> — ${esc(item.category)}</p>`).join('') || '<p>No named landmarks found.</p>'}`;
    } catch (error) { landmarks.textContent = error.message || 'Could not load nearby landmarks.'; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); video.srcObject = stream; await video.play();
      frame?.classList.remove('is-loading'); frame?.classList.add('is-active'); status.textContent = 'Camera is on. Use the nearby landmark list alongside the live view.';
    } catch (error) {
      frame?.classList.remove('is-loading'); status.textContent = error.name === 'NotAllowedError' ? 'Camera access was blocked. Allow camera permission in the browser, then try again.' : 'Camera preview is unavailable on this device. The nearby landmark list is still available.';
    } finally { startButton.disabled = false; startButton.innerHTML = 'Start camera guide <span>→</span>'; }
  };
  window.addEventListener('pagehide', () => video.srcObject?.getTracks().forEach(track => track.stop()));
})();
