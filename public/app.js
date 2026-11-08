'use strict';

const heroList = document.querySelector('#hero-list');
const favoriteList = document.querySelector('#favorite-list');
const search = document.querySelector('#hero-search');
const sort = document.querySelector('#hero-sort');
const dialog = document.querySelector('#favorite-dialog');
const form = document.querySelector('#favorite-form');
const noteInput = document.querySelector('#favorite-note');
const saveButton = document.querySelector('#save-favorite');
const refreshButton = document.querySelector('#refresh-button');
let heroes = [];
let favorites = [];
let selectedHeroId;
let dialogFromFavorites = false;
let editing = false;
let mutationPending = false;
let loading = false;
let returnRefreshPending = false;
let favoritesRequest = 0;
let catalogError = '';
let statusTimer;
let currentPage = 1;
const pageSize = 12;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Noget gik galt. Prøv igen.');
  return body;
}

function showStatus(message, isError = false) {
  clearTimeout(statusTimer);
  const status = document.querySelector('#status');
  status.textContent = message;
  status.classList.toggle('error', isError);
  if (!isError) statusTimer = setTimeout(() => { status.textContent = ''; }, 6000);
}

function portrait(hero, className) {
  const container = element('div', `portrait ${className}`);
  const letter = element('span', 'portrait-letter', hero?.name?.charAt(0) || 'S');
  letter.setAttribute('aria-hidden', 'true');
  container.append(letter);
  // Only display ordinary HTTPS images received from the external API.
  let imageUrl;
  try {
    const url = new URL(hero?.image);
    if (url.protocol === 'https:') imageUrl = url.href;
  } catch { /* A missing image leaves the letter visible. */ }
  if (imageUrl) {
    const image = element('img');
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    container.append(image);
  }
  return container;
}

function bookmarkIcon() {
  const namespace = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(namespace, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('width', '15');
  icon.setAttribute('height', '15');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.5');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', 'M6 3h12v18l-6-4-6 4V3Z');
  icon.append(path);
  return icon;
}

function renderCatalog() {
  const query = search.value.trim().toLocaleLowerCase('da');
  const filtered = heroes.filter(hero => `${hero.name} ${hero.fullName}`.toLocaleLowerCase('da').includes(query));
  filtered.sort((left, right) => {
    if (sort.value === 'strength') {
      return (right.strength ?? -1) - (left.strength ?? -1) || left.name.localeCompare(right.name, 'da');
    }
    return left.name.localeCompare(right.name, 'da') || left.id - right.id;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(currentPage, pageCount);
  const start = (currentPage - 1) * pageSize;
  const favoriteIds = new Set(favorites.map(favorite => favorite.id));
  const fragment = document.createDocumentFragment();

  for (const hero of filtered.slice(start, start + pageSize)) {
    const row = element('article', 'hero-row');
    const image = portrait(hero, 'hero-portrait');
    const isFavorite = favoriteIds.has(hero.id);
    const button = element('button', `save-button${isFavorite ? ' is-saved' : ''}`);
    button.type = 'button';
    button.dataset.mutation = '';
    button.dataset.heroId = hero.id;
    button.disabled = mutationPending;
    const action = isFavorite ? `Rediger noten for ${hero.name}` : `Gem ${hero.name} som favorit`;
    button.setAttribute('aria-label', action);
    button.title = action;
    button.append(bookmarkIcon(), element('span', 'save-label', isFavorite ? 'Note' : 'Gem'));
    button.addEventListener('click', () => openFavoriteDialog(hero.id));

    const name = element('div', 'hero-name');
    const title = element('h3', '', hero.name);
    title.id = `hero-title-${hero.id}`;
    row.setAttribute('aria-labelledby', title.id);
    const identity = hero.fullName || 'Ikke oplyst';
    const metadata = element('p', 'hero-name-meta', identity);
    name.append(title, metadata);

    const strength = element('div', 'hero-power');
    strength.setAttribute('aria-label', `Styrke: ${hero.strength ?? 'ukendt'}`);
    const meter = element('span', 'power-meter');
    meter.setAttribute('aria-hidden', 'true');
    const fill = element('span');
    fill.style.width = `${Math.max(0, Math.min(100, hero.strength ?? 0))}%`;
    meter.append(fill);
    strength.append(element('span', 'power-value', String(hero.strength ?? '—')), meter);
    row.append(image, name, element('span', 'hero-identity', identity), strength, button);
    fragment.append(row);
  }

  heroList.replaceChildren(fragment);
  const initialLoad = loading && heroes.length === 0 && !catalogError;
  document.querySelector('#hero-total').textContent = initialLoad ? '—' : String(heroes.length);
  document.querySelector('#result-count').textContent = initialLoad ? 'Henter helte…' : `${filtered.length} ${filtered.length === 1 ? 'helt' : 'helte'}`;
  const message = document.querySelector('#catalog-message');
  message.hidden = filtered.length > 0;
  message.textContent = initialLoad ? 'Henter superhelte…' : catalogError || (heroes.length ? 'Ingen helte matcher din søgning. Prøv et andet navn.' : 'Der er ingen helte at vise lige nu.');
  document.querySelector('#catalog-pagination').hidden = filtered.length === 0;
  document.querySelector('#catalog-range').textContent = `Viser ${start + 1}–${Math.min(start + pageSize, filtered.length)} af ${filtered.length}`;
  document.querySelector('#page-number').textContent = `Side ${currentPage} af ${pageCount}`;
  document.querySelector('#previous-page').disabled = currentPage === 1;
  document.querySelector('#next-page').disabled = currentPage === pageCount;
}

function renderFavorites() {
  const heroesById = new Map(heroes.map(hero => [hero.id, hero]));
  const fragment = document.createDocumentFragment();

  for (const favorite of favorites) {
    const hero = heroesById.get(favorite.id);
    const name = hero?.name || 'Ukendt helt';
    const card = element('article', 'favorite-card');
    const top = element('div', 'favorite-card-top');
    const heading = element('div');
    heading.append(element('h3', '', name));
    if (hero?.fullName) heading.append(element('p', '', hero.fullName));
    top.append(portrait(hero, 'favorite-portrait'), heading);
    const actions = element('div', 'favorite-actions');
    const edit = element('button', 'text-button', 'Rediger note');
    edit.type = 'button';
    edit.dataset.mutation = '';
    edit.dataset.heroId = favorite.id;
    edit.disabled = mutationPending;
    edit.setAttribute('aria-label', `Rediger noten for ${name}`);
    edit.addEventListener('click', () => openFavoriteDialog(favorite.id, true));
    const remove = element('button', 'text-button danger', 'Slet');
    remove.type = 'button';
    remove.dataset.mutation = '';
    remove.disabled = mutationPending;
    remove.setAttribute('aria-label', `Slet ${name} fra favoritter`);
    remove.addEventListener('click', () => removeFavorite(favorite.id, name));
    actions.append(edit, remove);
    card.append(top, element('p', 'favorite-note', favorite.note), actions);
    fragment.append(card);
  }

  favoriteList.replaceChildren(fragment);
  document.querySelector('#nav-favorite-count').textContent = String(favorites.length);
  document.querySelector('#favorite-badge').textContent = String(favorites.length);
  const message = document.querySelector('#favorites-message');
  message.hidden = favorites.length > 0;
  message.querySelector('h3').textContent = 'Ingen favoritter endnu';
  message.querySelector('p').textContent = 'Gem en helt fra kataloget, og tilføj en note.';
}

async function refreshFavorites() {
  const requestNumber = ++favoritesRequest;
  const latestFavorites = await apiRequest('/favorites');
  // A slow earlier response must not replace a more recent refresh.
  if (requestNumber !== favoritesRequest) return;
  favorites = latestFavorites;
  renderFavorites();
  renderCatalog();
  document.querySelector('#last-sync').textContent = `Synkroniseret kl. ${new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}`;
}

async function loadData(announce = false) {
  if (loading) return;
  loading = true;
  refreshButton.disabled = true;
  const results = await Promise.allSettled([
    apiRequest('/superheroes').then(data => { heroes = data; catalogError = ''; }),
    refreshFavorites(),
  ]);
  const errors = [];
  if (results[0].status === 'rejected') {
    catalogError = 'Heltene kunne ikke hentes. Brug “Opdater data” for at prøve igen.';
    errors.push(results[0].reason.message);
  }
  if (results[1].status === 'rejected') errors.push(results[1].reason.message);
  loading = false;
  renderCatalog();
  renderFavorites();
  heroList.setAttribute('aria-busy', 'false');
  favoriteList.setAttribute('aria-busy', 'false');
  document.querySelector('#connection-label').textContent = errors.length ? 'Data kunne ikke hentes' : 'Data er opdateret';
  document.querySelector('#connection-dot').className = `connection-dot ${errors.length ? 'offline' : 'online'}`;
  if (errors.length) {
    if (results[1].status === 'rejected') {
      const message = document.querySelector('#favorites-message');
      message.hidden = false;
      message.querySelector('h3').textContent = 'Kunne ikke hente favoritter';
      message.querySelector('p').textContent = 'Favoritterne kunne ikke hentes. Prøv at opdatere data.';
    }
    showStatus(`Kunne ikke hente alle data: ${errors.join(' ')}`, true);
  } else if (announce) showStatus('Katalog og favoritter er opdateret.');
  refreshButton.disabled = mutationPending;
}

function setMutationPending(pending) {
  mutationPending = pending;
  document.querySelectorAll('[data-mutation]').forEach(button => { button.disabled = pending; });
  saveButton.disabled = pending;
  refreshButton.disabled = pending || loading;
  document.querySelector('#close-dialog').disabled = pending;
}

function openFavoriteDialog(id, fromFavorites = false) {
  if (mutationPending) return;
  selectedHeroId = id;
  dialogFromFavorites = fromFavorites;
  const hero = heroes.find(candidate => candidate.id === id);
  const favorite = favorites.find(candidate => candidate.id === id);
  editing = Boolean(favorite);
  document.querySelector('#dialog-title').textContent = hero?.name || 'Ukendt helt';
  document.querySelector('#dialog-eyebrow').textContent = editing ? 'Rediger favorit' : 'Gem favorit';
  document.querySelector('#dialog-description').textContent = editing ? 'Opdater noten til denne helt.' : 'Tilføj en note, og gem helten som favorit.';
  document.querySelector('#dialog-error').textContent = '';
  noteInput.value = favorite?.note || '';
  noteInput.setCustomValidity('');
  saveButton.textContent = editing ? 'Gem ændringer' : 'Gem favorit';
  dialog.showModal();
  noteInput.focus();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const note = noteInput.value.trim();
  noteInput.setCustomValidity(note.length < 2 ? 'Skriv en note på mindst 2 tegn.' : '');
  if (!form.reportValidity() || mutationPending) return;
  setMutationPending(true);
  saveButton.textContent = 'Gemmer…';
  document.querySelector('#dialog-error').textContent = '';
  try {
    await apiRequest(editing ? `/favorites/${selectedHeroId}` : '/favorites', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { note } : { id: selectedHeroId, note }),
    });
    dialog.close();
    await refreshAfterMutation(editing ? 'Noten er opdateret.' : 'Favoritten er gemt.');
  } catch (error) {
    document.querySelector('#dialog-error').textContent = error.message;
    showStatus(error.message, true);
    // Another browser may have changed the same favorite in the meantime.
    await refreshFavorites().catch(() => {});
    editing = favorites.some(favorite => favorite.id === selectedHeroId);
  } finally {
    setMutationPending(false);
    saveButton.textContent = editing ? 'Gem ændringer' : 'Gem favorit';
    if (!dialog.open) {
      const source = dialogFromFavorites ? favoriteList : heroList;
      source.querySelector(`[data-hero-id="${selectedHeroId}"]`)?.focus({ preventScroll: true });
    }
  }
});

async function removeFavorite(id, name) {
  if (mutationPending) return;
  setMutationPending(true);
  let removed = false;
  try {
    await apiRequest(`/favorites/${id}`, { method: 'DELETE' });
    removed = true;
    await refreshAfterMutation(`${name} er slettet fra favoritter.`);
  } catch (error) {
    showStatus(error.message, true);
    await refreshFavorites().catch(() => {});
  } finally {
    setMutationPending(false);
    if (removed) document.querySelector('#favorites-title').focus({ preventScroll: true });
  }
}

async function refreshAfterMutation(message) {
  try {
    await refreshFavorites();
    showStatus(message);
  } catch (error) {
    showStatus(`${message} Listen kunne ikke genhentes: ${error.message}`, true);
  }
}

noteInput.addEventListener('input', () => noteInput.setCustomValidity(''));
function resetCatalog() {
  currentPage = 1;
  renderCatalog();
}

function changePage(offset) {
  currentPage += offset;
  renderCatalog();
  document.querySelector('#catalog-title').focus({ preventScroll: true });
  document.querySelector('#catalog').scrollIntoView({ block: 'start' });
}

search.addEventListener('input', resetCatalog);
sort.addEventListener('change', resetCatalog);
document.querySelector('#previous-page').addEventListener('click', () => changePage(-1));
document.querySelector('#next-page').addEventListener('click', () => changePage(1));
refreshButton.addEventListener('click', () => loadData(true));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', event => { if (mutationPending) event.preventDefault(); });

// Refresh shared server state when the user returns from another browser/tab.
function refreshOnReturn() {
  if (!document.hidden && !mutationPending && !loading && !returnRefreshPending) {
    returnRefreshPending = true;
    refreshFavorites()
      .catch(error => showStatus(`Favoritterne kunne ikke opdateres: ${error.message}`, true))
      .finally(() => { returnRefreshPending = false; });
  }
}
window.addEventListener('focus', refreshOnReturn);
document.addEventListener('visibilitychange', refreshOnReturn);

loadData();
