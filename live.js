(() => {
  const params = new URLSearchParams(location.search); const type = params.get('type') || 'places';
  const destination = document.getElementById('liveDestination'); const origin = document.getElementById('liveOrigin'); const departureDate = document.getElementById('liveDepartureDate'); const results = document.getElementById('liveResults');
  const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
  const labels = { weather: ['🌤️ LIVE WEATHER', 'Current weather'], places: ['📍 LIVE PLACES', 'Best places nearby'], hotel: ['🏨 LIVE HOTELS', 'Hotels nearby'], food: ['🍛 LIVE FOOD', 'Local food nearby'], transport: ['🚆 TRANSPORT & ROUTES', 'Nearby train, bus and flight options'], emergency: ['🆘 EMERGENCY HELP', 'Nearby hospitals & police'], map: ['🗺️ SMART MAPS', 'Live route planner'] };
  const [eyebrow, title] = labels[type] || labels.places; document.getElementById('liveEyebrow').textContent = eyebrow; document.getElementById('liveTitle').textContent = title;
  destination.value = params.get('destination') || '';
  if (origin) origin.value = params.get('origin') || '';
  if (departureDate) { const today = localToday(); departureDate.min = today; departureDate.value = params.get('departureDate') || today; if (departureDate.value < today) departureDate.value = today; }
  if (type !== 'transport') { document.querySelector('.transport-origin-group')?.setAttribute('hidden', ''); document.querySelector('.transport-date-group')?.setAttribute('hidden', ''); }
  const esc = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
  const mapButton = (item, label = 'View on map') => `<button class="action-btn map" type="button" data-map-name="${esc(item.name)}" data-map-lat="${esc(item.lat)}" data-map-lon="${esc(item.lon)}">${label}</button>`;
  let activeInternalMap = null;
  const showEmbeddedMap = (canvas, name, latitude, longitude) => {
    // Leaflet's default marker image can be blocked by a browser or CDN. This
    // OpenStreetMap embed keeps the map and its pin inside the guide as a fallback.
    const delta = 0.012;
    const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].map(value => value.toFixed(6)).join('%2C');
    const marker = `${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`;
    canvas.innerHTML = `<iframe class="internal-map-embed" title="Map of ${esc(name)}" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${marker}" loading="eager" referrerpolicy="no-referrer"></iframe>`;
  };
  const renderInternalMap = (canvas, name, latitude, longitude) => {
    if (!window.L) { showEmbeddedMap(canvas, name, latitude, longitude); return; }
    const map = L.map(canvas, { zoomControl: true }).setView([latitude, longitude], 15);
    activeInternalMap = map;
    let loadedTiles = 0; let failedTiles = 0;
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 });
    tiles.on('tileload', () => { loadedTiles += 1; }).on('tileerror', () => { failedTiles += 1; });
    tiles.addTo(map);
    const marker = L.divIcon({ className: 'ars-map-pin', html: '<span aria-hidden="true">📍</span>', iconSize: [34, 34], iconAnchor: [17, 32], popupAnchor: [0, -30] });
    L.marker([latitude, longitude], { icon: marker }).addTo(map).bindPopup(`<b>${esc(name)}</b>`).openPopup();
    requestAnimationFrame(() => map.invalidateSize());
    // If individual map tiles are blocked, replace Leaflet with the embedded
    // map rather than leaving the traveller with a blank panel.
    window.setTimeout(() => {
      if (activeInternalMap === map && !loadedTiles) {
        map.remove(); activeInternalMap = null; showEmbeddedMap(canvas, name, latitude, longitude);
      }
    }, 3500);
  };
  const openInternalMap = (name, lat, lon) => {
    let panel = document.getElementById('internalMapPanel');
    if (!panel) { panel = document.createElement('section'); panel.id = 'internalMapPanel'; panel.className = 'internal-map-panel'; results.prepend(panel); }
    if (activeInternalMap) { activeInternalMap.remove(); activeInternalMap = null; }
    panel.innerHTML = `<div><span>🗺️ IN-APP MAP</span><h2>${esc(name)}</h2><p>Location shown inside ARS Tourist Guide.</p></div><button type="button" class="ticket-close" aria-label="Close map">×</button><div id="internalMapCanvas"></div>`;
    const latitude = Number(lat); const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { document.getElementById('internalMapCanvas').innerHTML = '<p>This location does not include map coordinates yet.</p>'; panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    renderInternalMap(document.getElementById('internalMapCanvas'), name, latitude, longitude);
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const ticketPanel = (mode, selection = '') => {
    const place = destination.value.trim(); const from = origin?.value.trim() || 'Your starting city'; const date = departureDate?.value || 'Select a departure date';
    const panel = document.getElementById('ticketBookingPanel'); if (!panel) return;
    const isFlight = mode === 'flight';
    const choices = isFlight ? '' : `<div class="ticket-options"><button type="button" data-ticket-mode="train" data-ticket-selection="Morning route">Morning route · 06:30</button><button type="button" data-ticket-mode="train" data-ticket-selection="Day route">Day route · 12:15</button><button type="button" data-ticket-mode="train" data-ticket-selection="Overnight route">Overnight route · 21:40</button></div>`;
    panel.innerHTML = `<div class="ticket-panel-heading"><div><span>${isFlight ? '✈️ FLIGHT BOOKING' : '🚆 TRAIN BOOKING'}</span><h2>${selection ? `Selected: ${esc(selection)}` : `Choose your ${isFlight ? 'flight' : 'train'} option`}</h2><p>${esc(from)} → ${esc(place)} · ${esc(date)}</p></div><button type="button" class="ticket-close" aria-label="Close booking panel">×</button></div>${choices}<form id="ticketRequestForm" class="ticket-request-form"><div class="input-group"><label for="ticketPassengers">Passengers</label><select id="ticketPassengers"><option value="1">1 passenger</option><option value="2">2 passengers</option><option value="3">3 passengers</option><option value="4">4 passengers</option></select></div><div class="input-group"><label for="ticketClass">Travel class</label><select id="ticketClass"><option>Economy / Sleeper</option><option>Premium Economy / 3A</option><option>Business / 2A</option></select></div><button class="generate-btn" type="submit">Continue on ARS Tourist Guide</button></form><p class="ticket-message" id="ticketMessage">No new tab will open. Your selection stays on this website.</p>`;
    panel.hidden = false; panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  window.quickSave = (name, selectedDestination, itemType) => { const saved = JSON.parse(localStorage.getItem('arsWishlist') || '[]'); if (!saved.some(item => item.name === name && item.destination === selectedDestination && item.type === itemType)) { saved.push({ name, destination: selectedDestination, type: itemType }); localStorage.setItem('arsWishlist', JSON.stringify(saved)); } alert(`${name} saved to your wishlist.`); };
  async function request(url) {
    if (location.protocol === 'file:') throw new Error('Start the server and open http://localhost:3010. Do not open the HTML file directly.');
    try { const response = await fetch(url); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Please try again.'); return data; }
    catch (error) { if (error.message === 'Failed to fetch') throw new Error('Could not connect to the server. Run start.bat, then open http://localhost:3010.'); throw error; }
  }
  async function load() {
    const place = destination.value.trim(); const from = origin?.value.trim() || ''; if (!place) { results.innerHTML = '<p>Please enter a destination.</p>'; return; }
    if (type === 'transport' && (!departureDate?.value || departureDate.value < localToday())) { results.innerHTML = '<p>Please choose a departure date of today or later.</p>'; departureDate?.focus(); return; }
    if (type === 'hotel') document.getElementById('liveTitle').textContent = `Hotels in ${place}`;
    const button = document.getElementById('liveLoad'); button.disabled = true; button.innerHTML = 'Loading live information…'; results.innerHTML = '<div class="live-loading"><span></span><p>Finding the best live results for your trip…</p></div>';
    try {
      if (type === 'map') { const [places, hotels, food] = await Promise.all([request(`/api/places?destination=${encodeURIComponent(place)}`), request(`/api/places?kind=hotel&destination=${encodeURIComponent(place)}`), request(`/api/places?kind=food&destination=${encodeURIComponent(place)}`)]); const pins = [...places.items.map(item => ({ ...item, label: 'Place', color: '#087f6a' })), ...hotels.items.map(item => ({ ...item, label: 'Hotel', color: '#6543bb' })), ...food.items.map(item => ({ ...item, label: 'Food', color: '#c06b18' }))].filter(item => item.lat && item.lon); results.innerHTML = `<article class="transport-card live-map-card"><span>🗺️ LIVE MAP</span><h3>${esc(place)} map pins</h3><p>Attractions, hotels and restaurants shown directly inside ARS Tourist Guide.</p><div id="liveMapCanvas"></div></article>`; if (window.L && pins.length) { const map = L.map('liveMapCanvas').setView([pins[0].lat, pins[0].lon], 12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map); pins.forEach(pin => L.circleMarker([pin.lat, pin.lon], { radius: 8, color: pin.color, fillColor: pin.color, fillOpacity: .85 }).addTo(map).bindPopup(`<b>${esc(pin.name)}</b><br>${pin.label}`)); } else if (!pins.length) { document.getElementById('liveMapCanvas').outerHTML = '<p>No named pins found; try a nearby city.</p>'; } return; }
      if (type === 'weather') { const data = await request(`/api/weather?destination=${encodeURIComponent(place)}`); const alert = data.alert || { level: 'clear', title: 'No major weather alert', text: 'Check conditions again before leaving.' }; results.innerHTML = `<article class="transport-card live-weather-card"><span>LIVE WEATHER</span><h3>${data.icon} ${esc(data.location)}</h3><p>${esc(data.condition)} · <strong>${data.temperature}°C</strong></p><div class="weather-mini"><div>💧<b>${data.humidity}%</b><small>Humidity</small></div><div>💨<b>${data.wind} km/h</b><small>Wind</small></div><div>🌧️<b>${data.rain} mm</b><small>Rain</small></div></div><div class="weather-alert ${esc(alert.level)}" role="status"><strong>${esc(alert.title)}</strong><p>${esc(alert.text)}</p></div></article>`; return; }
      const kind = type === 'places' ? '' : `&kind=${encodeURIComponent(type)}`; const data = await request(`/api/places?destination=${encodeURIComponent(place)}${kind}`);
      if (type === 'hotel') {
        results.innerHTML = data.items.length ? data.items.map(item => `<article class="hotel-card"><div class="hotel-image"><img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80" alt="Hotel near ${esc(place)}" loading="lazy"></div><div><span class="rating">🏨 ${esc(item.category || 'Hotel')}</span><h3>${esc(item.name)}</h3><p>📍 ${esc(item.address || `Near ${place}`)}</p><strong>View the location in our map</strong>${mapButton(item, 'View stay map')}</div></article>`).join('') : `<p>No named hotels found near ${esc(place)}. Try a nearby city.</p>`;
        return;
      }
      if (type === 'emergency') {
        const helpCard = `<article class="transport-card live-emergency-card"><span>🆘 IMMEDIATE HELP</span><h3>Call 112 for emergency assistance</h3><p>If there is an immediate danger or medical emergency in India, call 112 first. Then use the locations below for nearby help.</p><a class="action-btn emergency-call" href="tel:112">Call 112 now</a></article>`;
        const nearbyCards = data.items.length ? data.items.map(item => `<article class="transport-card"><span>🏥 ${esc(item.category)}</span><h3>${esc(item.name)}</h3><p>${esc(item.address || `Near ${place}`)}</p>${mapButton(item, 'Open map here')}</article>`).join('') : `<p>No named help locations found near ${esc(place)}. Call 112 if help is urgent.</p>`;
        results.innerHTML = helpCard + nearbyCards;
        return;
      }
      if (type === 'transport') {
        const routeLabel = from ? `${from} to ${place}` : `to ${place}`;
        const date = departureDate?.value || '';
        const trainStations = data.items.filter(item => /railway|station|train/i.test(item.category || '')).slice(0, 3);
        const busStations = data.items.filter(item => /bus/i.test(item.category || '')).slice(0, 3);
        const stationCards = (items, icon, label) => items.length ? items.map(item => `<article class="transport-card"><span>${icon} ${label}</span><h3>${esc(item.name)}</h3><p>${esc(item.address || `Near ${place}`)}</p>${mapButton(item, 'Open station map')}</article>`).join('') : `<article class="transport-card"><span>${icon} ${label}</span><h3>Find a nearby ${label.toLowerCase()} point</h3><p>Search again for nearby stations around ${esc(place)}.</p></article>`;
        let flightCards = `<article class="transport-card live-flight-card"><span>✈️ FLIGHT</span><h3>Flights ${esc(routeLabel)}</h3><p>Enter both cities and a date to view live availability and fares here.</p><button class="action-btn map" type="button" data-ticket-mode="flight">See flight options</button></article>`;
        if (from && date) { try { const flights = await request(`/api/flights/offers?origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(place)}&departureDate=${encodeURIComponent(date)}`); flightCards = flights.items.length ? flights.items.map(item => `<article class="transport-card live-flight-card"><span>✈️ ${esc(item.airline)} · ${esc(item.flight)}</span><h3>${esc(item.departure.replace('T', ' '))} → ${esc(item.arrival.replace('T', ' '))}</h3><p>${esc(item.stops ? `${item.stops} stop${item.stops > 1 ? 's' : ''}` : 'Non-stop')} · ${esc(item.duration.replace('PT', '').replace('H', 'h ').replace('M', 'm'))}</p><strong>${esc(item.currency)} ${Number(item.price || 0).toLocaleString('en-IN')}</strong><button class="action-btn map" type="button" data-ticket-mode="flight" data-ticket-selection="${esc(`${item.airline} ${item.flight}`)}">Select flight</button></article>`).join('') : flightCards; } catch (error) { flightCards = `<article class="transport-card live-flight-card"><span>✈️ FLIGHT</span><h3>Live flight offers unavailable</h3><p>${esc(error.message)}</p><button class="action-btn map" type="button" data-ticket-mode="flight">Continue with flight enquiry</button></article>`; } }
        results.innerHTML = `<div class="route-summary"><span>🛫 ${esc(from || 'Choose a starting city')}</span><b>→</b><span>📍 ${esc(place)}</span></div><div class="transport-mode-grid">${flightCards}<article class="transport-card live-train-card"><span>🚆 TRAIN</span><h3>Train tickets & routes</h3><p>See train route choices ${esc(routeLabel)} without leaving ARS Tourist Guide.</p><button class="action-btn map" type="button" data-ticket-mode="train">See train options</button></article><article class="transport-card live-bus-card"><span>🚌 BUS</span><h3>Bus routes & stops</h3><p>Nearby bus stops are shown below. Select a stop to view it on our map.</p></article></div><section id="ticketBookingPanel" class="ticket-booking-panel" hidden></section><div class="transport-station-list"><h2>Nearby train & bus stations in ${esc(place)}</h2>${stationCards(trainStations, '🚆', 'TRAIN STATION')}${stationCards(busStations, '🚌', 'BUS STOP')}</div>`;
        return;
      }
      results.innerHTML = data.items.length ? data.items.map(item => `<article class="transport-card"><span>${esc(item.category)}</span><h3>${esc(item.name)}</h3><p>${esc(item.address || 'Near selected destination')}</p>${mapButton(item, 'Open map here')}<button class="text-link" data-name="${esc(item.name)}" data-destination="${esc(place)}" data-type="${esc(type)}" onclick="quickSave(this.dataset.name,this.dataset.destination,this.dataset.type)">♡ Save</button></article>`).join('') : '<p>No named results found. Try a nearby city.</p>';
    } catch (error) { results.innerHTML = `<div class="live-error"><div>⚠️</div><h3>Live information could not be loaded</h3><p>${esc(error.message || 'Please try again.')}</p><a class="live-back" href="index.HTML">← Back to home</a></div>`; }
    finally { button.disabled = false; button.innerHTML = 'Load live information <span>→</span>'; }
  }
  results.addEventListener('click', event => {
    const mapControl = event.target.closest('[data-map-name]');
    if (mapControl) { openInternalMap(mapControl.dataset.mapName, mapControl.dataset.mapLat, mapControl.dataset.mapLon); return; }
    const ticketButton = event.target.closest('[data-ticket-mode]');
    if (ticketButton) { ticketPanel(ticketButton.dataset.ticketMode, ticketButton.dataset.ticketSelection || ''); return; }
    if (event.target.closest('.ticket-close')) {
      const mapPanel = event.target.closest('#internalMapPanel');
      if (mapPanel) { if (activeInternalMap) { activeInternalMap.remove(); activeInternalMap = null; } mapPanel.remove(); } else document.getElementById('ticketBookingPanel').hidden = true;
    }
  });
  results.addEventListener('submit', event => {
    if (event.target.id !== 'ticketRequestForm') return;
    event.preventDefault();
    const message = document.getElementById('ticketMessage');
    if (!departureDate?.value || departureDate.value < localToday()) { if (message) message.textContent = 'Choose a departure date of today or later before continuing.'; departureDate?.focus(); return; }
    if (message) message.textContent = 'Your travel preference is saved on this page. Online ticket confirmation can be added when a train or flight booking provider is connected.';
  });
  document.getElementById('liveLoad').addEventListener('click', load); [destination, origin, departureDate].filter(Boolean).forEach(input => input.addEventListener('keydown', event => { if (event.key === 'Enter') load(); })); if (destination.value) load();
})();
