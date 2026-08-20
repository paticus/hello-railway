const map = L.map('map', { worldCopyJump: true }).setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 18,
}).addTo(map);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function addPinToMap(pin) {
  const marker = L.marker([pin.lat, pin.lng]).addTo(map);
  const when = new Date(pin.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  marker.bindPopup(
    `<div class="pin-popup"><strong>${escapeHtml(pin.name)}</strong><span>${when}</span></div>`
  );
  return marker;
}

async function loadPins() {
  try {
    const res = await fetch('/api/pins');
    const pins = await res.json();
    pins.forEach(addPinToMap);
  } catch (err) {
    console.error('Failed to load pins', err);
  }
}

loadPins();

const overlay = document.getElementById('modal-overlay');
const statusEl = document.getElementById('modal-status');
const nameInput = document.getElementById('name-input');
const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');
const dropPinBtn = document.getElementById('drop-pin-btn');
const toast = document.getElementById('toast');

let pendingCoords = null;
let toastTimer = null;
let pickingOnMap = false;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function openModal() {
  overlay.classList.remove('hidden');
  pendingCoords = null;
  nameInput.value = '';
  confirmBtn.disabled = true;
  statusEl.innerHTML = 'Getting your location…';

  if (!navigator.geolocation) {
    offerMapPicker('Geolocation is not supported by your browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      pendingCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      statusEl.textContent = `Location found (±${Math.round(pos.coords.accuracy)}m). Enter your name below.`;
      updateConfirmState();
      nameInput.focus();
    },
    (err) => {
      offerMapPicker(`Couldn't get your location (${err.message}).`);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function offerMapPicker(reason) {
  statusEl.innerHTML = '';
  const p = document.createElement('span');
  p.textContent = `${reason} `;
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = 'Click here, then tap a spot on the map instead.';
  link.addEventListener('click', (e) => {
    e.preventDefault();
    startMapPicking();
  });
  statusEl.appendChild(p);
  statusEl.appendChild(link);
}

function startMapPicking() {
  pickingOnMap = true;
  overlay.classList.add('hidden');
  showToast('Tap anywhere on the map to place your pin');
  map.getContainer().style.cursor = 'crosshair';
}

map.on('click', (e) => {
  if (!pickingOnMap) return;
  pickingOnMap = false;
  map.getContainer().style.cursor = '';
  pendingCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
  overlay.classList.remove('hidden');
  statusEl.textContent = `Location set (${pendingCoords.lat.toFixed(3)}, ${pendingCoords.lng.toFixed(3)}). Enter your name below.`;
  updateConfirmState();
  nameInput.focus();
});

function closeModal() {
  overlay.classList.add('hidden');
  if (pickingOnMap) {
    pickingOnMap = false;
    map.getContainer().style.cursor = '';
  }
}

function updateConfirmState() {
  confirmBtn.disabled = !(pendingCoords && nameInput.value.trim());
}

dropPinBtn.addEventListener('click', openModal);
cancelBtn.addEventListener('click', closeModal);
nameInput.addEventListener('input', updateConfirmState);

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

confirmBtn.addEventListener('click', async () => {
  if (!pendingCoords) return;
  const name = nameInput.value.trim();
  if (!name) return;

  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Dropping…';

  try {
    const res = await fetch('/api/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, lat: pendingCoords.lat, lng: pendingCoords.lng }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to drop pin');
    }

    const pin = await res.json();
    const marker = addPinToMap(pin);
    map.flyTo([pin.lat, pin.lng], 5);
    marker.openPopup();
    showToast(`Pinned ${pin.name}!`);
    closeModal();
  } catch (err) {
    showToast(err.message);
  } finally {
    confirmBtn.textContent = 'Drop Pin';
    updateConfirmState();
  }
});
