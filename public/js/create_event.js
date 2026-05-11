// ─── STEP NAVIGATION ───────────────────────────────────────────────────────

// Affiche l'étape n et met à jour les indicateurs visuels
function goStep(n) {
  [1, 2, 3, 4].forEach(i => {
    // Affiche / cache le panneau de l'étape
    document.getElementById('create-step-' + i).style.display = i === n ? 'block' : 'none';

    // Met à jour le cercle de l'étape (active / done / neutre)
    const circle = document.getElementById('step-' + i);
    const label  = document.getElementById('slabel-' + i);
    if (circle) {
      circle.classList.toggle('active', i === n);
      circle.classList.toggle('done',   i < n);
    }
    if (label) {
      label.classList.toggle('active', i === n);
      label.classList.toggle('done',   i < n);
    }

    // Met à jour la ligne de connexion entre étapes
    const line = document.getElementById('line-' + i);
    if (line) line.classList.toggle('done', i < n);
  });

  // Cas spécial : étape 4 → remplir le résumé de prévisualisation
  if (n === 4) fillPreview();
}

// ─── TICKET BUILDER ────────────────────────────────────────────────────────

// Ajoute une ligne vide dans le tableau de tickets
document.getElementById('add-ticket-btn').addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'ticket-builder-row';
  row.innerHTML = `
    <div class="tb-cell"><input type="text"   placeholder="e.g. VIP"           class="t-name"></div>
    <div class="tb-cell"><input type="text"   placeholder="Description"         class="t-desc"></div>
    <div class="tb-cell"><input type="number" placeholder="0" min="0"           class="t-price"></div>
    <div class="tb-cell"><button class="tb-del" onclick="deleteTicketRow(this)">✕</button></div>
  `;
  // Insère avant le bouton "Add" (= à la fin du tableau)
  document.getElementById('ticket-builder').appendChild(row);
});

// Supprime la ligne de ticket parente du bouton cliqué
function deleteTicketRow(btn) {
  btn.closest('.ticket-builder-row').remove();
}

// ─── PREVIEW (STEP 4) ──────────────────────────────────────────────────────

// Lit les valeurs du formulaire et remplit le résumé de prévisualisation
function fillPreview() {
  const title    = document.getElementById('title').value        || '(no title)';
  const date     = document.getElementById('start_date').value   || '—';
  const location = document.getElementById('location').value     || '—';
  const capacity = document.getElementById('capacity').value     || '—';
  const tickets  = collectTickets();

  document.getElementById('preview-title').textContent = title;

  // Calcule le prix minimum parmi les tickets
  const prices   = tickets.map(t => parseFloat(t.price)).filter(p => !isNaN(p));
  const minPrice = prices.length ? `from €${Math.min(...prices)}` : 'Free';

  document.getElementById('preview-meta').innerHTML = `
    <span>📅 ${date}</span>
    <span>📍 ${location}</span>
    <span>🎫 ${tickets.length} ticket type(s) · ${minPrice}</span>
    <span>👥 Max ${capacity} attendees</span>
  `;
}

// ─── DATA COLLECTION ───────────────────────────────────────────────────────

// Lit toutes les lignes du tableau tickets et retourne un tableau d'objets
function collectTickets() {
  const rows = document.querySelectorAll('#ticket-builder .ticket-builder-row:not(.tb-header)');
  const tickets = [];
  rows.forEach(row => {
    const name  = row.querySelector('.t-name')?.value.trim();
    const desc  = row.querySelector('.t-desc')?.value.trim();
    const price = row.querySelector('.t-price')?.value;
    // Ignore les lignes incomplètes
    if (name) tickets.push({ name, description: desc || '', price: parseFloat(price) || 0 });
  });
  return tickets;
}

// ─── PUBLISH ───────────────────────────────────────────────────────────────

document.getElementById('publish-btn').addEventListener('click', async () => {
  const errorEl = document.getElementById('publish-error');
  errorEl.style.display = 'none';

  // Combine date + heure pour former un timestamp ISO complet
  const startDate = document.getElementById('start_date').value;
  const startTime = document.getElementById('start_time').value || '00:00';
  const endDate   = document.getElementById('end_date').value;
  const endTime   = document.getElementById('end_time').value   || '00:00';
  const imageUrl  = document.getElementById('cover_image_url').value.trim();

  const payload = {
    title:           document.getElementById('title').value.trim(),
    description:     document.getElementById('description').value.trim(),
    category:        document.getElementById('category').value,
    format:          document.getElementById('format').value,
    start_date:      startDate ? `${startDate}T${startTime}` : null,
    end_date:        endDate   ? `${endDate}T${endTime}`     : null,
    location:        document.getElementById('location').value.trim(),
    capacity:        parseInt(document.getElementById('capacity').value) || null,
    cover_image_url: imageUrl || null,   // null si champ vide
    tickets:         collectTickets(),
  };

  // Validation basique côté client
  if (!payload.title || !payload.start_date) {
    errorEl.textContent = 'Please fill in the event title and start date.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    document.getElementById('publish-btn').disabled = true;
    document.getElementById('publish-btn').textContent = 'Publishing…';

    const res = await fetch('/api/events', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'An error occurred.';
      errorEl.style.display = 'block';
      return;
    }

    // Succès → redirige vers le dashboard
    window.location.href = '/dashboard';

  } catch (err) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.style.display = 'block';
  } finally {
    document.getElementById('publish-btn').disabled = false;
    document.getElementById('publish-btn').textContent = '🚀 Publish event';
  }
});

// ─── TOAST HELPER ──────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── NAV : affiche le nom de l'utilisateur connecté ────────────────────────

(async () => {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    if (data?.username) {
      document.getElementById('nav-username').textContent = data.username;
      document.getElementById('nav-avatar').textContent =
        (data.first_name?.[0] || '') + (data.last_name?.[0] || '');
    }
  } catch (_) { /* silencieux si non connecté */ }
})();