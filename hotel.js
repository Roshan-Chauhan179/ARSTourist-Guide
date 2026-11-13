(() => {
  const input = document.getElementById('hotelDestination'); const results = document.getElementById('hotelResults');
  const todayDate = (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })();
  const checkInInput = document.getElementById('hotelCheckIn'); const checkOutInput = document.getElementById('hotelCheckOut');
  const nextDate = date => { const next = new Date(`${date}T00:00:00`); next.setDate(next.getDate() + 1); return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`; };
  [checkInInput, checkOutInput].filter(Boolean).forEach(input => { input.min = todayDate; if (input.value && input.value < todayDate) input.value = ''; });
  const syncCheckout = () => { if (!checkOutInput) return; checkOutInput.min = checkInInput?.value ? nextDate(checkInInput.value) : todayDate; if (checkOutInput.value && checkOutInput.value < checkOutInput.min) checkOutInput.value = ''; };
  checkInInput?.addEventListener('change', syncCheckout); syncCheckout();
  // The API returns up to six stays. Keep one distinct hotel image per card so
  // different results do not look like duplicated listings.
  const photos = ['photo-1566073771259-6a8506099945', 'photo-1551882547-ff40c63fe5fa', 'photo-1564501049412-61c2a3083791', 'photo-1582719478250-c89cae4dc85b', 'photo-1542314831-068cd1dbfeeb', 'photo-1571896349842-33c89424de2d'];
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[c]); let reservation = null;
  const favourites = () => JSON.parse(localStorage.getItem('arsFavouriteHotels') || '[]');
  const isFavourite = (name, place) => favourites().some(item => item.name === name && item.place === place);
  const toggleFavourite = (item, place) => {
    const saved = favourites(); const index = saved.findIndex(entry => entry.name === item.name && entry.place === place);
    if (index >= 0) saved.splice(index, 1); else saved.push({ name: item.name, place, savedAt: new Date().toISOString() });
    localStorage.setItem('arsFavouriteHotels', JSON.stringify(saved)); load();
    const wishlist = JSON.parse(localStorage.getItem('arsWishlist') || '[]'); const wishIndex = wishlist.findIndex(entry => entry.name === item.name && entry.destination === place && entry.type === 'Hotel');
    if (index >= 0 && wishIndex >= 0) wishlist.splice(wishIndex, 1); else if (index < 0 && wishIndex < 0) wishlist.push({ name: item.name, destination: place, type: 'Hotel' });
    localStorage.setItem('arsWishlist', JSON.stringify(wishlist));
  };
  input.value = new URLSearchParams(location.search).get('destination') || '';
  async function load() {
    const place = input.value.trim(); if (!place) { input.focus(); return; }
    if (checkInInput?.value && checkInInput.value < todayDate) { checkInInput.value = ''; checkInInput.focus(); return; }
    if (checkOutInput?.value && checkOutInput.value < (checkOutInput.min || todayDate)) { checkOutInput.value = ''; checkOutInput.focus(); return; }
    const button = document.getElementById('hotelLoad'); button.disabled = true; button.innerHTML = 'Finding stays…'; results.innerHTML = '<div class="live-loading"><span></span><p>Finding hotels near your destination…</p></div>';
    try {
      const checkIn = checkInInput?.value; const checkOut = checkOutInput?.value; const guests = document.getElementById('hotelGuests').value || '2';
      const useLiveOffers = Boolean(checkIn && checkOut);
      const endpoint = useLiveOffers
        ? `/api/hotels/offers?destination=${encodeURIComponent(place)}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&adults=${encodeURIComponent(guests)}`
        : `/api/places?kind=hotel&destination=${encodeURIComponent(place)}`;
      const response = await fetch(endpoint); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load hotels.');
      results.innerHTML = data.items.length ? `<div class="hotel-page-heading"><p>${useLiveOffers ? 'AMADEUS LIVE OFFERS' : 'LIVE STAYS'}</p><h2>Hotels near ${esc(data.location || place)}</h2><span>${useLiveOffers ? 'Current availability and total stay prices from Amadeus.' : 'Choose dates to see live availability, then reserve on ARS.'}</span></div><div class="hotel-grid">${data.items.map((item, i) => { const stars = Number(item.stars || item.rating); const starLabel = stars ? `${'★'.repeat(Math.min(5, Math.round(stars)))} ${esc(item.stars || item.rating)}-star listed` : '★ Star level not listed'; const livePrice = item.price ? `${esc(item.currency)} ${Number(item.price).toLocaleString('en-IN')} total` : ''; return `<article class="hotel-card"><div class="hotel-image"><img src="https://images.unsplash.com/${photos[i % photos.length]}?auto=format&fit=crop&w=900&q=85" alt="Hotel near ${esc(place)}" loading="lazy"></div><div><span class="rating">🏨 ${esc(item.category || item.room || 'Hotel')}</span><h3>${esc(item.name)}</h3><p class="hotel-stars">${livePrice || starLabel}</p><p>📍 ${esc(item.address || `Near ${place}`)}</p><div class="hotel-actions">${item.lat ? `<a class="text-link" href="live.html?type=map&destination=${encodeURIComponent(place)}">Map</a>` : ''}<button class="favourite-hotel" data-save-hotel="${i}">${isFavourite(item.name, place) ? '♥ Saved' : '♡ Save'}</button>${useLiveOffers ? `<button class="ops-primary" type="button" data-reserve-hotel="${i}">Reserve on ARS</button>` : ''}</div></div></article>`; }).join('')}</div>` : `<div class="live-empty"><div>🏨</div><h3>No matching hotel offers found</h3><p>Try different dates or a nearby city.</p></div>`;
      results.querySelectorAll('[data-save-hotel]').forEach(button => button.addEventListener('click', () => toggleFavourite(data.items[Number(button.dataset.saveHotel)], place)));
      results.querySelectorAll('[data-reserve-hotel]').forEach(button => button.addEventListener('click', () => window.openHotelBooking(data.items[Number(button.dataset.reserveHotel)], data.location || place, checkIn, checkOut, guests)));
    } catch (error) { results.innerHTML = `<div class="live-error"><div>⚠️</div><h3>Hotels could not be loaded</h3><p>${esc(error.message)}</p></div>`; }
    finally { button.disabled = false; button.innerHTML = 'Show hotels <span>→</span>'; }
  }
  window.openHotelBooking = (hotel, destination, checkIn, checkOut, guests) => {
    if (!localStorage.getItem('arsUser')) { alert('Please log in on the home page before reserving a hotel.'); return; }
    if (!checkIn || !checkOut || checkIn < todayDate || checkOut < todayDate || checkOut <= checkIn) { alert('Choose a check-in date of today or later and a check-out date after check-in.'); checkInInput?.focus(); return; }
    reservation = { hotel, destination, checkIn, checkOut, guests: Number(guests) || 1 };
    document.getElementById('hotelBookingTitle').textContent = `Reserve: ${hotel.name}`;
    document.getElementById('hotelBookingSummary').textContent = `${destination} · ${checkIn} to ${checkOut} · ${guests} guest(s)${hotel.price ? ` · quoted ${hotel.currency || 'INR'} ${Number(hotel.price).toLocaleString('en-IN')}` : ''}`;
    document.getElementById('hotelBookingPanel').hidden = false; document.getElementById('hotelBookingPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  window.closeHotelBooking = () => { document.getElementById('hotelBookingPanel').hidden = true; };
  window.createHotelBooking = async event => {
    event.preventDefault(); if (!reservation) return;
    const button = event.target.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Sending request…';
    try {
      const response = await fetch('/api/bookings', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingType: 'hotel', hotelName: reservation.hotel.name, destination: reservation.destination, checkIn: reservation.checkIn, checkOut: reservation.checkOut, guests: reservation.guests, quotedTotal: reservation.hotel.price, currency: reservation.hotel.currency, room: reservation.hotel.room, contactPhone: document.getElementById('hotelBookingPhone').value }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not create reservation request.');
      closeHotelBooking(); results.innerHTML = `<div class="live-empty"><div>✅</div><h3>Reservation request received</h3><p>Reference: <strong>${esc(data.bookingCode)}</strong>. Our team will confirm availability and payment details.</p></div>`;
    } catch (error) { alert(error.message); } finally { button.disabled = false; button.textContent = 'Send reservation request'; }
  };
  document.getElementById('hotelLoad').addEventListener('click', load); input.addEventListener('keydown', e => { if (e.key === 'Enter') load(); }); if (input.value) load();
})();
