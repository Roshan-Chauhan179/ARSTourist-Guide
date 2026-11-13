(() => {
  const notice = document.getElementById('adminNotice');
  const money = value => `₹${Number(value).toLocaleString('en-IN')}`;
  const api = async (url, options = {}) => {
    const response = await fetch(url, { ...options, credentials: 'same-origin', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    const data = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  };
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const setRows = (id, items, createRow, emptyText) => document.getElementById(id).replaceChildren(...(items.length ? items.map(createRow) : [element('p', emptyText)]));
  const dataRow = (title, details, action) => {
    const row = element('div', undefined, 'data-row');
    row.append(element('b', title), document.createElement('br'), element('small', details));
    if (action) row.append(document.createElement('br'), action);
    return row;
  };
  async function removeResource(url, message) {
    try { await api(url, { method: 'DELETE' }); notice.textContent = message; await loadDashboard(); }
    catch (error) { notice.textContent = error.message; }
  }
  function renderSummary(summary) {
    const cards = [['Users', summary.users], ['Packages', summary.packages], ['Bookings', summary.bookings], ['Paid bookings', summary.paid]];
    document.getElementById('summary').replaceChildren(...cards.map(([label, value]) => {
      const card = element('article', undefined, 'summary-card'); card.append(element('span', label), element('strong', String(value))); return card;
    }));
  }
  function renderPackages(items) {
    setRows('adminPackages', items, item => {
      const remove = element('button', 'Delete', 'danger'); remove.addEventListener('click', () => removeResource(`/api/admin/packages/${item.id}`, 'Package deleted.'));
      return dataRow(item.title, `${money(item.price)} · ${item.seats_left} seats · ${item.active ? 'Active' : 'Hidden'}`, remove);
    }, 'No packages.');
  }
  function renderBookings(items) { setRows('adminBookings', items, item => dataRow(`${item.booking_code} · ${item.title || 'Package removed'}`, `${item.user_name} · ${money(item.total_amount)} · Payment: ${item.payment_status} · Booking: ${item.booking_status}`), 'No bookings.'); }
  function renderUsers(items) { setRows('adminUsers', items, item => dataRow(item.name, `${item.email} · Joined ${item.created_at}`), 'No users.'); }
  function renderGallery(items) {
    setRows('adminGallery', items, item => {
      const remove = element('button', 'Delete', 'danger'); remove.addEventListener('click', () => removeResource(`/api/admin/gallery/${item.id}`, 'Gallery item deleted.'));
      return dataRow(item.title, item.media_type, remove);
    }, 'No media.');
  }
  async function loadDashboard() {
    try {
      const [summary, packages, bookings, users, gallery] = await Promise.all([api('/api/admin/summary'), api('/api/admin/packages'), api('/api/admin/bookings'), api('/api/admin/users'), api('/api/gallery')]);
      renderSummary(summary); renderPackages(packages); renderBookings(bookings); renderUsers(users); renderGallery(gallery);
    } catch (error) { notice.textContent = error.message; }
  }
  document.getElementById('packageForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const body = { title: form.get('title'), destination: form.get('destination'), days: Number(form.get('days')), price: Number(form.get('price')), seats: Number(form.get('seats')), photoUrl: form.get('photoUrl'), inclusions: form.get('inclusions').split('\n').map(value => value.trim()).filter(Boolean) };
    try { await api('/api/admin/packages', { method: 'POST', body: JSON.stringify(body) }); event.currentTarget.reset(); notice.textContent = 'Package added.'; await loadDashboard(); }
    catch (error) { notice.textContent = error.message; }
  });
  document.getElementById('galleryForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await api('/api/admin/gallery', { method: 'POST', body: JSON.stringify({ title: form.get('title'), mediaUrl: form.get('mediaUrl'), mediaType: form.get('mediaType') }) }); event.currentTarget.reset(); notice.textContent = 'Gallery item added.'; await loadDashboard(); }
    catch (error) { notice.textContent = error.message; }
  });
  loadDashboard();
})();
