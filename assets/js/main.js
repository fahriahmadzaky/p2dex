/* ==========================================
   MAIN.JS — P2Dex App Core
   ========================================== */

window.P2Dex = window.P2Dex || {};

(function () {
  const { utils, api } = P2Dex;
  const { lsGet, lsSet, lsRemove, capitalize, padId, typeBadge, debounce, showToast, statColor, statLabel } = utils;

  /* ==========================================
     STATE
     ========================================== */

  const state = {
    currentPage: 'home',
    theme: lsGet('p2dex-theme', 'light'),
    favorites: lsGet('p2dex-favorites', []),
    team: lsGet('p2dex-team', []),

    // Pokédex
    allPokemon: [],     // full list from API (name+url)
    filteredPokemon: [],
    displayedPokemon: [],
    pokedexOffset: 0,
    pokedexBatch: 24,
    filterType: '',
    filterGen: '',
    sortBy: 'id',
    sortDir: 'asc',
    searchQuery: '',
    totalCount: 0,
    isFetchingBatch: false,
    isFavoritesMode: false,

    // Detail modal
    modalPokemon: null,
    modalTab: 'about',

    // Compare
    compareSlot: [null, null],
  };

  /* ==========================================
     DOM CACHE
     ========================================== */

  const DOM = {
    // Navigation
    sidebarNavItems: document.querySelectorAll('.sidebar .nav-item'),
    bottomNavItems:  document.querySelectorAll('.bottom-nav .bottom-nav-item'),
    pages:           document.querySelectorAll('.page'),

    // Sidebar (tablet expand)
    sidebar:        document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),

    // Theme
    themeToggle:   document.getElementById('themeToggle'),
    themeIcon:     document.getElementById('themeIcon'),
    darkModeToggle: document.getElementById('darkModeToggle'),

    // Home
    featuredName: document.getElementById('featuredName'),
    featuredDesc: document.getElementById('featuredDesc'),
    featuredTypes: document.getElementById('featuredTypes'),
    featuredImg:   document.getElementById('featuredImg'),
    featuredBtn:   document.getElementById('featuredBtn'),
    popularGrid:   document.getElementById('popularGrid'),
    homeSearch:    document.getElementById('homeSearch'),

    // Pokédex
    pokedexGrid:    document.getElementById('pokedexGrid'),
    pokedexCount:   document.getElementById('pokedexCount'),
    pokedexSearch:  document.getElementById('pokedexSearch'),
    filterType:     document.getElementById('filterType'),
    filterGen:      document.getElementById('filterGen'),
    sortBy:         document.getElementById('sortBy'),
    sortDirBtn:     document.getElementById('sortDirBtn'),
    sortDirIcon:    document.getElementById('sortDirIcon'),
    loadMoreBtn:    document.getElementById('loadMoreBtn'),
    pokedexSpinner: document.getElementById('pokedexSpinner'),

    // Teams
    teamSlots:    document.getElementById('teamSlots'),
    teamSearch:   document.getElementById('teamSearch'),
    teamSearchGrid: document.getElementById('teamSearchGrid'),
    clearTeamBtn: document.getElementById('clearTeamBtn'),

    // Compare
    compareSearch1:  document.getElementById('compareSearch1'),
    compareSearch2:  document.getElementById('compareSearch2'),
    compareResults1: document.getElementById('compareResults1'),
    compareResults2: document.getElementById('compareResults2'),
    pickerEmpty1:    document.getElementById('pickerEmpty1'),
    pickerEmpty2:    document.getElementById('pickerEmpty2'),
    pickerSelected1: document.getElementById('pickerSelected1'),
    pickerSelected2: document.getElementById('pickerSelected2'),
    compareImg1:     document.getElementById('compareImg1'),
    compareImg2:     document.getElementById('compareImg2'),
    compareName1:    document.getElementById('compareName1'),
    compareName2:    document.getElementById('compareName2'),
    compareTypes1:   document.getElementById('compareTypes1'),
    compareTypes2:   document.getElementById('compareTypes2'),
    compareTable:    document.getElementById('compareTable'),

    // Settings
    favCount:             document.getElementById('favCount'),
    teamCount:            document.getElementById('teamCount'),
    cacheCount:           document.getElementById('cacheCount'),
    clearFavBtn:          document.getElementById('clearFavBtn'),
    clearTeamSettingsBtn: document.getElementById('clearTeamSettingsBtn'),
    clearCacheBtn:        document.getElementById('clearCacheBtn'),
    clearAllBtn:          document.getElementById('clearAllBtn'),

    // Modal
    modalOverlay: document.getElementById('modalOverlay'),
    modalClose:   document.getElementById('modalClose'),
    modalHeader:  document.getElementById('modalHeader'),
    modalNumber:  document.getElementById('modalNumber'),
    modalName:    document.getElementById('modalName'),
    modalTypes:   document.getElementById('modalTypes'),
    modalImg:     document.getElementById('modalImg'),
    modalBody:    document.getElementById('modalBody'),
    tabBtns:      document.querySelectorAll('.tab-btn'),
    modalFavBtn:  document.getElementById('modalFavBtn'),
    modalTeamBtn: document.getElementById('modalTeamBtn'),

    // Toast
    toast: document.getElementById('toast'),

    // Confirm dialog
    confirmOverlay: document.getElementById('confirmOverlay'),
    confirmTitle:   document.getElementById('confirmTitle'),
    confirmDesc:    document.getElementById('confirmDesc'),
    confirmOk:      document.getElementById('confirmOk'),
    confirmCancel:  document.getElementById('confirmCancel'),
  };

  /* ==========================================
     THEME
     ========================================== */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    lsSet('p2dex-theme', theme);
    if (DOM.themeIcon) {
      DOM.themeIcon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    if (DOM.darkModeToggle) {
      DOM.darkModeToggle.checked = theme === 'dark';
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
  }

  /* ==========================================
     CONFIRM DIALOG
     ========================================== */

  let _confirmResolve = null;

  function showConfirm({ title, desc, okLabel = 'Confirm' }) {
    return new Promise((resolve) => {
      _confirmResolve = resolve;
      DOM.confirmTitle.textContent = title;
      DOM.confirmDesc.textContent = desc;
      DOM.confirmOk.textContent = okLabel;
      DOM.confirmOverlay.classList.remove('hidden');
    });
  }

  function closeConfirm(result) {
    DOM.confirmOverlay.classList.add('hidden');
    if (_confirmResolve) {
      _confirmResolve(result);
      _confirmResolve = null;
    }
  }

  /* ==========================================
     NAVIGATION
     ========================================== */

  function navigateTo(page) {
    // Reset favorites mode if leaving pokedex
    if (page !== 'pokedex' && state.isFavoritesMode) {
      state.isFavoritesMode = false;
    }

    state.currentPage = page;

    DOM.pages.forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
    DOM.sidebarNavItems.forEach(item => item.classList.toggle('active', item.dataset.page === page));
    DOM.bottomNavItems.forEach(item => item.classList.toggle('active', item.dataset.page === page));

    if (page === 'settings') updateSettingsPage();
    if (page === 'teams') renderTeamSlots();
    if (page === 'home') {
      state.searchQuery = '';
      if (DOM.pokedexSearch) DOM.pokedexSearch.value = '';
      if (DOM.homeSearch) DOM.homeSearch.value = '';
    }
  }

  /* ==========================================
     RENDER POKEMON CARD
     ========================================== */

  function renderCard(pokemon, opts = {}) {
    const { id, name } = pokemon;
    const isFav = state.favorites.includes(id);
    const spriteUrl = api.getSpriteUrl(id);
    const fallback  = api.getSpriteFallback(id);
    const types = (pokemon.types || []).map(t => t.type.name);
    const typesHtml = types.map(t => typeBadge(t)).join('');

    const card = document.createElement('div');
    card.className = 'pokemon-card';
    card.dataset.id = id;
    card.innerHTML = `
      <span class="card-number">${padId(id)}</span>
      <div class="card-img-wrap">
        <img class="card-img" 
             src="${spriteUrl}" 
             alt="${name}"
             onerror="this.src='${fallback}'" 
             loading="lazy" />
      </div>
      <span class="card-name">${capitalize(name)}</span>
      <div class="card-types">${typesHtml}</div>
      <button class="card-fav-btn ${isFav ? 'active' : ''}" data-id="${id}" aria-label="Toggle favorite">
        <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
      </button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) return;
      if (opts.addToTeam) {
        addToTeam(pokemon);
      } else {
        openModal(id);
      }
    });

    card.querySelector('.card-fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(id, card.querySelector('.card-fav-btn'));
    });

    return card;
  }

  /* ==========================================
     HOME PAGE
     ========================================== */

  async function loadHomePage() {
    await loadFeatured();
    await loadPopular();
  }

  function applyFeaturedColors(color1, color2) {
    const featuredCard = document.getElementById('featuredCard');
    if (featuredCard) {
      featuredCard.style.background = `linear-gradient(135deg, ${color1}ee 0%, ${color2}cc 100%)`;
      featuredCard.style.boxShadow = `0 8px 32px ${color1}55`;
    }
    if (DOM.featuredBtn) {
      DOM.featuredBtn.style.background = 'rgba(255,255,255,0.22)';
      DOM.featuredBtn.style.color = 'white';
      DOM.featuredBtn.style.backdropFilter = 'blur(4px)';
      DOM.featuredBtn.style.border = '1px solid rgba(255,255,255,0.3)';
      DOM.featuredBtn.classList.add('btn-featured');
    }
  }

  async function loadFeatured() {
    try {
      const today = new Date();
      const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
      const featuredId = (dayOfYear % 151) + 1;

      // Apply cached colors immediately to avoid flash
      const cached = lsGet('p2dex-featured-colors', null);
      if (cached && cached.id === featuredId) {
        applyFeaturedColors(cached.color1, cached.color2);
      }

      const pokemon = await api.getPokemon(featuredId);
      const types = pokemon.types.map(t => t.type.name);

      DOM.featuredName.textContent = capitalize(pokemon.name);
      DOM.featuredTypes.innerHTML = types.map(t => typeBadge(t, 'featured')).join('');

      // Fetch species for flavor text description
      try {
        const species = await api.getSpecies(featuredId);
        const desc = api.getEnglishFlavorText(species);
        if (DOM.featuredDesc) DOM.featuredDesc.textContent = desc;
      } catch {
        if (DOM.featuredDesc) DOM.featuredDesc.textContent = '';
      }

      const spriteUrl = api.getSpriteUrl(featuredId);
      DOM.featuredImg.src = spriteUrl;
      DOM.featuredImg.alt = pokemon.name;
      DOM.featuredImg.onerror = () => { DOM.featuredImg.src = api.getSpriteFallback(featuredId); };

      DOM.featuredBtn.onclick = () => openModal(featuredId);

      // Apply type colors and cache for next load
      const color1 = utils.getTypeColor(types[0]);
      const color2 = types[1] ? utils.getTypeColor(types[1]) : color1;
      applyFeaturedColors(color1, color2);
      lsSet('p2dex-featured-colors', { id: featuredId, color1, color2 });



    } catch (err) {
      console.error('Featured load error:', err);
      DOM.featuredName.textContent = 'Pikachu';
    }
  }

  const POPULAR_IDS = [6, 25, 39, 94, 130, 131, 143, 149, 150, 151];

  async function loadPopular() {
    DOM.popularGrid.innerHTML = '';
    const promises = POPULAR_IDS.map(id => api.getPokemon(id));
    try {
      const results = await Promise.all(promises);
      results.forEach(pokemon => {
        const card = renderCard({ id: pokemon.id, name: pokemon.name, types: pokemon.types });
        DOM.popularGrid.appendChild(card);
      });
    } catch (err) {
      console.error('Popular load error:', err);
    }
  }

  /* ==========================================
     POKÉDEX PAGE
     ========================================== */

  async function loadPokedex() {
    if (state.allPokemon.length > 0) {
      applyFiltersAndRender();
      return;
    }
    await ensurePokedexData();
    applyFiltersAndRender();
  }

  async function ensurePokedexData() {
    if (state.allPokemon.length > 0) return;
    showSpinner(true);
    try {
      const data = await api.getPokemonList(1025, 0);
      state.allPokemon = data.results.map((p, i) => ({
        id: i + 1,
        name: p.name,
      }));
      state.totalCount = state.allPokemon.length;
      await loadTypeFilter();
    } catch (err) {
      console.error('Pokédex load error:', err);
      DOM.pokedexCount.textContent = 'Failed to load. Check connection.';
    } finally {
      showSpinner(false);
    }
  }

  async function loadTypeFilter() {
    try {
      const types = await api.getTypeList();
      DOM.filterType.innerHTML = '<option value="">All Types</option>' +
        types.map(t => `<option value="${t.name}">${capitalize(t.name)}</option>`).join('');
    } catch {}
  }

  function applyFiltersAndRender() {
    const query = state.searchQuery.toLowerCase().trim();
    const type  = state.filterType;
    const gen   = state.filterGen;
    const sort  = state.sortBy;
    const dir   = state.sortDir === 'desc' ? -1 : 1;

    let filtered = state.allPokemon.filter(p => {
      if (query && !p.name.includes(query) && !String(p.id).includes(query)) return false;
      if (gen && !api.inGenRange(p.id, gen)) return false;
      if (sort === 'favorites') return state.favorites.includes(p.id);
      return true;
    });

    if (sort === 'name') {
      filtered.sort((a, b) => dir * a.name.localeCompare(b.name));
    } else if (sort === 'favorites') {
      filtered.sort((a, b) => dir * (state.favorites.indexOf(a.id) - state.favorites.indexOf(b.id)));
    } else {
      filtered.sort((a, b) => dir * (a.id - b.id));
    }

    disconnectScrollObserver();
    state.filteredPokemon = filtered;
    state.pokedexOffset = 0;
    state.isFetchingBatch = false;
    DOM.pokedexGrid.innerHTML = '';
    DOM.loadMoreBtn.style.display = 'none';

    if (filtered.length === 0) {
      DOM.pokedexGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-search"></i><p>No Pokémon found</p></div>';
      updatePokedexCount();
      return;
    }

    renderNextBatch().then(() => setupScrollObserver());
  }

  function renderSkeletons(count) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const sk = document.createElement('div');
      sk.className = 'pokemon-card card-skeleton';
      sk.innerHTML = `
        <div class="sk-number"></div>
        <div class="sk-img"></div>
        <div class="sk-name"></div>
        <div class="sk-types"><div class="sk-badge"></div><div class="sk-badge"></div></div>
      `;
      frag.appendChild(sk);
    }
    return frag;
  }

  async function renderNextBatch() {
    if (state.isFetchingBatch) return;
    const batch = state.filteredPokemon.slice(state.pokedexOffset, state.pokedexOffset + state.pokedexBatch);
    if (batch.length === 0) {
      updatePokedexCount();
      disconnectScrollObserver();
      return;
    }

    state.isFetchingBatch = true;

    // Insert skeletons
    const skeletons = renderSkeletons(batch.length);
    const skeletonEls = [];
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(skeletons);
    while (tempDiv.firstChild) {
      const el = tempDiv.firstChild;
      skeletonEls.push(el);
      DOM.pokedexGrid.appendChild(el);
    }

    try {
      const fetched = await Promise.all(
        batch.map(p => api.getPokemon(p.id).catch(() => null))
      );

      const typeFilter = state.filterType;
      const sort = state.sortBy;

      if (sort === 'hp' || sort === 'weight' || sort === 'height') {
        const dir = state.sortDir === 'desc' ? -1 : 1;
        fetched.sort((a, b) => {
          if (!a || !b) return 0;
          if (sort === 'hp') {
            const aHp = (a.stats.find(s => s.stat.name === 'hp') || {}).base_stat || 0;
            const bHp = (b.stats.find(s => s.stat.name === 'hp') || {}).base_stat || 0;
            return dir * (aHp - bHp);
          }
          if (sort === 'weight') return dir * (a.weight - b.weight);
          if (sort === 'height') return dir * (a.height - b.height);
          return 0;
        });
      }

      // Replace skeletons with real cards one by one
      let skIdx = 0;
      fetched.forEach((pokemon) => {
        if (!pokemon) {
          if (skeletonEls[skIdx]) skeletonEls[skIdx].remove();
          skIdx++;
          return;
        }
        if (typeFilter) {
          const hasType = pokemon.types.some(t => t.type.name === typeFilter);
          if (!hasType) {
            if (skeletonEls[skIdx]) skeletonEls[skIdx].remove();
            skIdx++;
            return;
          }
        }
        const idx = state.filteredPokemon.findIndex(p => p.id === pokemon.id);
        if (idx !== -1) state.filteredPokemon[idx].types = pokemon.types;

        const card = renderCard({ id: pokemon.id, name: pokemon.name, types: pokemon.types });
        if (skeletonEls[skIdx]) {
          DOM.pokedexGrid.replaceChild(card, skeletonEls[skIdx]);
        } else {
          DOM.pokedexGrid.appendChild(card);
        }
        skIdx++;
      });

      // Remove any leftover skeletons
      skeletonEls.slice(skIdx).forEach(el => { if (el.parentNode) el.remove(); });

      state.pokedexOffset += batch.length;

    } catch (err) {
      console.error('Batch render error:', err);
      skeletonEls.forEach(el => { if (el.parentNode) el.remove(); });
    } finally {
      state.isFetchingBatch = false;
      updatePokedexCount();
      // Reconnect observer to new sentinel position
      setupScrollObserver();
    }
  }

  /* ---- Infinite scroll via IntersectionObserver ---- */
  let _scrollObserver = null;
  let _sentinel = null;

  function setupScrollObserver() {
    disconnectScrollObserver();

    const hasMore = state.pokedexOffset < state.filteredPokemon.length;
    if (!hasMore) return;

    _sentinel = document.createElement('div');
    _sentinel.className = 'scroll-sentinel';
    DOM.pokedexGrid.after(_sentinel);

    _scrollObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        renderNextBatch();
      }
    }, { rootMargin: '200px' });

    _scrollObserver.observe(_sentinel);
  }

  function disconnectScrollObserver() {
    if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
    if (_sentinel && _sentinel.parentNode) { _sentinel.remove(); _sentinel = null; }
  }

  function updatePokedexCount() {
    const shown = DOM.pokedexGrid.querySelectorAll('.pokemon-card').length;
    const total = state.filteredPokemon.length;
    DOM.pokedexCount.textContent = `Showing ${shown} of ${total} Pokémon`;
  }

  /* ---- Favorites Mode ---- */
  async function enterFavoritesMode() {
    navigateTo('pokedex');
    await ensurePokedexData();

    // Set mode flag & sync state + dropdown UI
    state.isFavoritesMode = true;
    state.sortBy = 'favorites';
    if (DOM.sortBy) {
      DOM.sortBy.value = 'favorites';
      DOM.sortBy.classList.add('is-active');

      // Sync custom select trigger text (native .value alone doesn't update the custom UI)
      const customWrapper = document.querySelector(`.custom-select[data-select-id="${DOM.sortBy.id}"]`);
      if (customWrapper) {
        const triggerSpan = customWrapper.querySelector('.custom-select-trigger span');
        const selectedOpt = DOM.sortBy.options[DOM.sortBy.selectedIndex];
        if (triggerSpan && selectedOpt) triggerSpan.textContent = selectedOpt.text;
        customWrapper.classList.add('is-active');
      }
    }

    state.filteredPokemon = state.favorites.map(id => {
      const found = state.allPokemon.find(p => p.id === id);
      return found || { id, name: 'pokemon' };
    });
    state.pokedexOffset = 0;
    DOM.pokedexGrid.innerHTML = '';
    await renderNextBatch();
    DOM.pokedexCount.textContent = `Showing ${state.favorites.length} favorite(s)`;
  }

  function showSpinner(visible) {
    DOM.pokedexSpinner.classList.toggle('visible', visible);
  }

  /* ==========================================
     MODAL
     ========================================== */

  async function openModal(id) {
    DOM.modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Reset
    DOM.modalHeader.style.background = '#667eea';
    DOM.modalName.textContent = 'Loading...';
    DOM.modalTypes.innerHTML = '';
    DOM.modalImg.src = '';
    DOM.modalBody.innerHTML = '<div class="loading-spinner visible"><div class="spinner"></div></div>';

    // Default to About tab
    setModalTab('about');

    try {
      const pokemon = await api.getPokemon(id);
      state.modalPokemon = pokemon;

      const types = pokemon.types.map(t => t.type.name);
      const color1 = utils.getTypeColor(types[0]);
      const color2 = types[1] ? utils.getTypeColor(types[1]) : color1;

      DOM.modalHeader.style.background = `linear-gradient(to right, var(--bg-modal) 0%, var(--bg-modal) 20%, ${color1}00 40%, ${color1}cc 100%)`;
      DOM.modalNumber.textContent = padId(pokemon.id);
      DOM.modalName.textContent = capitalize(pokemon.name);
      DOM.modalTypes.innerHTML = types.map(t => typeBadge(t, 'featured')).join('');

      const spriteUrl = api.getSpriteUrl(id);
      DOM.modalImg.src = spriteUrl;
      DOM.modalImg.onerror = () => { DOM.modalImg.src = api.getSpriteFallback(id); };
      DOM.modalImg.alt = pokemon.name;

      updateModalFavBtn();
      updateModalTeamBtn();

      renderModalTab('about');

    } catch (err) {
      console.error('Modal open error:', err);
      DOM.modalBody.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Failed to load Pokémon</p></div>';
    }
  }

  function closeModal() {
    DOM.modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    state.modalPokemon = null;
  }

  function setModalTab(tab) {
    state.modalTab = tab;
    DOM.tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  }

  async function renderModalTab(tab) {
    setModalTab(tab);
    const pokemon = state.modalPokemon;
    if (!pokemon) return;

    DOM.modalBody.innerHTML = '<div class="loading-spinner visible"><div class="spinner"></div></div>';
    DOM.modalBody.classList.remove('modal-body--centered');

    try {
      if (tab === 'about')      await renderAboutTab(pokemon);
      if (tab === 'stats')      renderStatsTab(pokemon);
      if (tab === 'abilities')  await renderAbilitiesTab(pokemon);
      if (tab === 'evolution')  await renderEvolutionTab(pokemon);
    } catch (err) {
      console.error(`Tab render error (${tab}):`, err);
      DOM.modalBody.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Failed to load data</p></div>';
    }
  }

  async function renderAboutTab(pokemon) {
    let flavorText = '';
    let habitat = '—';
    try {
      const species = await api.getSpecies(pokemon.id);
      flavorText = api.getEnglishFlavorText(species);
      if (species.habitat && species.habitat.name) {
        habitat = capitalize(species.habitat.name.replace(/-/g, ' '));
      }
    } catch {}

    const height = (pokemon.height / 10).toFixed(1) + ' m';
    const weight = (pokemon.weight / 10).toFixed(1) + ' kg';
    const baseExp = pokemon.base_experience || '—';

    DOM.modalBody.innerHTML = `
      <div class="about-grid">
        <div class="about-item">
          <div class="about-item-label">Height</div>
          <div class="about-item-value">${height}</div>
        </div>
        <div class="about-item">
          <div class="about-item-label">Weight</div>
          <div class="about-item-value">${weight}</div>
        </div>
        <div class="about-item">
          <div class="about-item-label">Base EXP</div>
          <div class="about-item-value">${baseExp}</div>
        </div>
        <div class="about-item">
          <div class="about-item-label">Habitat</div>
          <div class="about-item-value">${habitat}</div>
        </div>
      </div>
      ${flavorText ? `<div class="about-desc">"${flavorText}"</div>` : ''}
    `;
  }

  function renderStatsTab(pokemon) {
    const stats = pokemon.stats;
    const total = stats.reduce((sum, s) => sum + s.base_stat, 0);
    const types = pokemon.types.map(t => t.type.name);
    const accentColor = utils.getTypeColor(types[0]);

    const statOrder = ['hp','attack','defense','special-attack','special-defense','speed'];
    const ordered = statOrder.map(name => {
      const found = stats.find(s => s.stat.name === name);
      return { name, val: found ? found.base_stat : 0 };
    });

    const rows = ordered.map(({ name, val }) => {
      const color = statColor(val);
      return `
        <div class="stat-row">
          <span class="stat-label">${statLabel(name)}</span>
          <span class="stat-val" style="color:${color}">${val}</span>
        </div>
      `;
    }).join('');

    const radarSvg = buildRadarSvg(ordered, accentColor);

    DOM.modalBody.innerHTML = `
      <div class="radar-wrap">${radarSvg}</div>
      <div class="stat-list">${rows}</div>
      <div class="stat-total">
        <span>Total</span>
        <span>${total}</span>
      </div>
    `;

    requestAnimationFrame(() => {
      animateRadar(DOM.modalBody.querySelector('.radar-polygon'));
    });
  }

  function buildRadarSvg(ordered, accentColor) {
    const cx = 110, cy = 110, r = 78;
    const n = ordered.length;
    const MAX = 255;

    function polarToXY(index, radius) {
      const angle = (Math.PI * 2 * index / n) - Math.PI / 2;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    }

    const rings = [0.2, 0.4, 0.6, 0.8, 1.0].map(level => {
      const pts = ordered.map((_, i) => {
        const { x, y } = polarToXY(i, r * level);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ');
      return `<polygon points="${pts}" fill="none" stroke="var(--border-color)" stroke-width="1" opacity="0.7"/>`;
    }).join('');

    const axes = ordered.map((_, i) => {
      const { x, y } = polarToXY(i, r);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="var(--border-color)" stroke-width="1" opacity="0.5"/>`;
    }).join('');

    const collapsedPoints = ordered.map(() => `${cx},${cy}`).join(' ');
    const dataPoints = ordered.map(({ val }, i) => {
      const { x, y } = polarToXY(i, r * (val / MAX));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    const labelPad = 20;
    const labels = ordered.map(({ name, val }, i) => {
      const { x, y } = polarToXY(i, r + labelPad);
      const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
      const short = statLabel(name);
      return `
        <text x="${x.toFixed(2)}" y="${(y - 2).toFixed(2)}" text-anchor="${anchor}" font-family="Lexend,sans-serif" font-size="9" font-weight="600" fill="var(--text-muted)">${short}</text>
        <text x="${x.toFixed(2)}" y="${(y + 11).toFixed(2)}" text-anchor="${anchor}" font-family="Lexend,sans-serif" font-size="10" font-weight="700" fill="var(--text-primary)">${val}</text>
      `;
    }).join('');

    const dots = ordered.map(({ val }, i) => {
      const { x, y } = polarToXY(i, r * (val / MAX));
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.5" fill="${accentColor}" stroke="var(--bg-modal)" stroke-width="2"/>`;
    }).join('');

    return `
      <svg viewBox="0 0 220 220" width="220" height="220" xmlns="http://www.w3.org/2000/svg">
        ${rings}
        ${axes}
        <polygon class="radar-polygon"
          points="${collapsedPoints}"
          data-target="${dataPoints}"
          fill="${accentColor}"
          fill-opacity="0.18"
          stroke="${accentColor}"
          stroke-width="2"
          stroke-linejoin="round"
        />
        ${dots}
        ${labels}
      </svg>
    `;
  }

  function animateRadar(polygon) {
    if (!polygon) return;
    const target = polygon.dataset.target;
    if (!target) return;
    const targetPts = target.trim().split(' ').map(p => p.split(',').map(Number));
    const startPts  = polygon.getAttribute('points').trim().split(' ').map(p => p.split(',').map(Number));
    const duration = 700;
    const ease = t => 1 - Math.pow(1 - t, 3);
    const start = performance.now();
    function frame(now) {
      const t = ease(Math.min((now - start) / duration, 1));
      const pts = startPts.map((sp, i) => {
        const tp = targetPts[i];
        return `${(sp[0] + (tp[0] - sp[0]) * t).toFixed(2)},${(sp[1] + (tp[1] - sp[1]) * t).toFixed(2)}`;
      }).join(' ');
      polygon.setAttribute('points', pts);
      if (now - start < duration) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  async function renderAbilitiesTab(pokemon) {
    const abilities = pokemon.abilities;
    let html = '';

    for (const a of abilities) {
      let desc = '';
      try {
        const data = await api.getAbility(a.ability.url);
        const entry = (data.effect_entries || []).find(e => e.language.name === 'en');
        desc = entry ? entry.short_effect : '';
      } catch {}

      html += `
        <div class="ability-card">
          <div class="ability-name">
            ${capitalize(a.ability.name)}
            ${a.is_hidden ? '<span class="ability-hidden-tag">Hidden</span>' : ''}
          </div>
          ${desc ? `<div class="ability-desc">${desc}</div>` : '<div class="ability-desc">No description available.</div>'}
        </div>
      `;
    }

    DOM.modalBody.innerHTML = html || '<div class="empty-state"><i class="fa-solid fa-wand-magic-sparkles"></i><p>No abilities found</p></div>';
  }

  async function renderEvolutionTab(pokemon) {
    try {
      const species = await api.getSpecies(pokemon.id);
      const chainData = await api.getEvolutionChain(species.evolution_chain.url);
      const tree = api.parseEvolutionChain(chainData);

      // Count total nodes
      function countNodes(node) {
        return 1 + node.evolvesTo.reduce((s, c) => s + countNodes(c), 0);
      }
      const total = countNodes(tree);

      if (total <= 1) {
        DOM.modalBody.innerHTML = '<div class="empty-state"><i class="fa-solid fa-dna"></i><p>This Pokémon does not evolve</p></div>';
        DOM.modalBody.classList.add('modal-body--centered');
        return;
      }

      // Check if branching
      function hasBranch(node) {
        if (node.evolvesTo.length > 1) return true;
        return node.evolvesTo.some(hasBranch);
      }
      const isBranching = hasBranch(tree);

      function evoCard(node) {
        const sprite = api.getSpriteUrl(node.id);
        const fallback = api.getSpriteFallback(node.id);
        const isActive = node.id === pokemon.id;
        return `
          <div class="evo-item${isActive ? ' evo-active' : ''}" data-evo-id="${node.id}">
            <img src="${sprite}" alt="${node.name}" onerror="this.src='${fallback}'" loading="lazy" />
            <span>${capitalize(node.name)}</span>
          </div>
        `;
      }

      // Arrow with trigger label below it
      function evoArrow(details, vertical = false) {
        const label = api.formatEvoTrigger(details);
        return `
          <div class="evo-arrow-wrap${vertical ? ' evo-arrow-wrap--v' : ''}">
            <span class="evo-arrow">${vertical ? '↓' : '→'}</span>
            ${label ? `<span class="evo-trigger-label">${label}</span>` : ''}
          </div>
        `;
      }

      let html = '';

      if (!isBranching) {
        // Linear: flatten and render with arrows + triggers
        const flat = [];
        function flatWalk(n) { flat.push(n); if (n.evolvesTo[0]) flatWalk(n.evolvesTo[0]); }
        flatWalk(tree);
        const items = flat.map((n, i) => {
          return `${i > 0 ? evoArrow(n.details) : ''}${evoCard(n)}`;
        }).join('');
        html = `<div class="evolution-chain">${items}</div>`;
      } else {
        // Branching: base → grid of branches (each with trigger label)
        function renderBranchLevel(node) {
          const branches = node.evolvesTo;
          if (branches.length === 0) return '';

          const branchCards = branches.map(b => {
            const subBranches = b.evolvesTo;
            const subHtml = subBranches.length > 0
              ? subBranches.map(sb => `${evoArrow(sb.details, true)}${evoCard(sb)}`).join('')
              : '';
            return `
              <div class="evo-branch-col">
                ${evoArrow(b.details, true)}
                ${evoCard(b)}
                ${subHtml ? `<div class="evo-branch-sub">${subHtml}</div>` : ''}
              </div>
            `;
          }).join('');

          return `<div class="evo-branch-grid">${branchCards}</div>`;
        }

        html = `
          <div class="evolution-chain evolution-chain--branching">
            ${evoCard(tree)}
            ${renderBranchLevel(tree)}
          </div>
        `;
      }

      DOM.modalBody.innerHTML = html;
      DOM.modalBody.classList.add('modal-body--centered');

      DOM.modalBody.querySelectorAll('.evo-item').forEach(item => {
        item.addEventListener('click', () => {
          const evoId = parseInt(item.dataset.evoId);
          if (evoId !== pokemon.id) openModal(evoId);
        });
      });

    } catch (err) {
      console.error('Evolution tab error:', err);
      DOM.modalBody.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Failed to load evolution data</p></div>';
    }
  }

  /* ==========================================
     FAVORITES
     ========================================== */

  function toggleFavorite(id, btn) {
    const idx = state.favorites.indexOf(id);
    if (idx === -1) {
      state.favorites.push(id);
      showToast(`Added to favorites!`);
      if (btn) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
      }
    } else {
      state.favorites.splice(idx, 1);
      showToast(`Removed from favorites`);
      if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
      }
      // If currently viewing favorites mode, remove card from grid immediately
      if (state.currentPage === 'pokedex' && (state.isFavoritesMode || state.sortBy === 'favorites')) {
        const card = DOM.pokedexGrid.querySelector(`.pokemon-card[data-id="${id}"]`);
        if (card) card.remove();
        state.filteredPokemon = state.filteredPokemon.filter(p => p.id !== id);
        updatePokedexCount();
      }
    }
    lsSet('p2dex-favorites', state.favorites);
    updateModalFavBtn();
    syncGridFavBtn(id);
  }

  function syncGridFavBtn(id) {
    const isFav = state.favorites.includes(id);
    document.querySelectorAll(`.pokemon-card[data-id="${id}"] .card-fav-btn`).forEach(btn => {
      btn.classList.toggle('active', isFav);
      btn.innerHTML = `<i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>`;
    });
  }

  function updateModalFavBtn() {
    if (!state.modalPokemon || !DOM.modalFavBtn) return;
    const isFav = state.favorites.includes(state.modalPokemon.id);
    DOM.modalFavBtn.innerHTML = `<i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i> ${isFav ? 'Favorited' : 'Add to Favorites'}`;
  }

  /* ==========================================
     TEAMS
     ========================================== */

  function addToTeam(pokemon) {
    if (state.team.length >= 6) {
      showToast('Team is full! Max 6 Pokémon.');
      return;
    }
    const alreadyIn = state.team.some(p => p.id === pokemon.id);
    if (alreadyIn) {
      showToast(`${capitalize(pokemon.name)} is already in your team!`);
      return;
    }
    const entry = {
      id: pokemon.id,
      name: pokemon.name,
      types: (pokemon.types || []).map(t => t.type ? t.type.name : t),
    };
    state.team.push(entry);
    lsSet('p2dex-team', state.team);
    showToast(`${capitalize(pokemon.name)} added to team!`);
    renderTeamSlots();
  }

  function removeFromTeam(id) {
    state.team = state.team.filter(p => p.id !== id);
    lsSet('p2dex-team', state.team);
    renderTeamSlots();
    showToast('Removed from team');
  }

  function renderTeamSlots() {
    const slots = DOM.teamSlots;
    slots.innerHTML = '';

    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'team-slot';
      const pokemon = state.team[i];

      if (pokemon) {
        slot.classList.add('filled');
        const types = (pokemon.types || []).map(t => typeof t === 'string' ? t : t.type?.name || t);
        const typesHtml = types.map(t => typeBadge(t)).join('');
        const spriteUrl = api.getSpriteUrl(pokemon.id);
        const fallback = api.getSpriteFallback(pokemon.id);

        slot.innerHTML = `
          <span class="slot-number">Slot ${i + 1}</span>
          <img class="slot-img" src="${spriteUrl}" alt="${pokemon.name}" onerror="this.src='${fallback}'" loading="lazy" />
          <span class="slot-name">${capitalize(pokemon.name)}</span>
          <div class="slot-types">${typesHtml}</div>
          <button class="slot-remove" data-id="${pokemon.id}" aria-label="Remove from team">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;

        slot.querySelector('.slot-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          removeFromTeam(pokemon.id);
        });

        slot.addEventListener('click', () => openModal(pokemon.id));

      } else {
        slot.innerHTML = `
          <span class="slot-number">Slot ${i + 1}</span>
          <span class="slot-empty-icon"><i class="fa-regular fa-circle-dot"></i></span>
          <span style="font-size:12px; color:var(--text-muted);">Empty</span>
        `;
      }

      slots.appendChild(slot);
    }

    updateModalTeamBtn();
  }

  function updateModalTeamBtn() {
    if (!state.modalPokemon || !DOM.modalTeamBtn) return;
    const inTeam = state.team.some(p => p.id === state.modalPokemon.id);
    DOM.modalTeamBtn.innerHTML = `<i class="fa-solid fa-${inTeam ? 'check' : 'plus'}"></i> ${inTeam ? 'In Team' : 'Add to Team'}`;
  }

  /* ==========================================
     COMPARE
     ========================================== */

  async function searchForCompare(query, slotIndex) {
    const resultsEl = slotIndex === 0 ? DOM.compareResults1 : DOM.compareResults2;
    resultsEl.innerHTML = '';

    if (!query.trim()) return;

    const matches = state.allPokemon
      .filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || String(p.id).includes(query))
      .slice(0, 8);

    if (matches.length === 0) {
      resultsEl.innerHTML = '<div style="padding:8px;font-size:13px;color:var(--text-muted)">No results</div>';
      return;
    }

    matches.forEach(p => {
      const item = document.createElement('div');
      item.className = 'compare-result-item';
      const fallback = api.getSpriteFallback(p.id);
      item.innerHTML = `
        <img src="${api.getSpriteUrl(p.id)}" alt="${p.name}" 
             onerror="this.src='${fallback}'" loading="lazy" />
        <span>${capitalize(p.name)}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${padId(p.id)}</span>
      `;
      item.addEventListener('click', () => selectCompare(p.id, slotIndex));
      resultsEl.appendChild(item);
    });
  }

  async function selectCompare(id, slotIndex) {
    try {
      const pokemon = await api.getPokemon(id);
      state.compareSlot[slotIndex] = pokemon;

      const emptyEl = slotIndex === 0 ? DOM.pickerEmpty1 : DOM.pickerEmpty2;
      const selectedEl = slotIndex === 0 ? DOM.pickerSelected1 : DOM.pickerSelected2;
      const imgEl = slotIndex === 0 ? DOM.compareImg1 : DOM.compareImg2;
      const nameEl = slotIndex === 0 ? DOM.compareName1 : DOM.compareName2;
      const typesEl = slotIndex === 0 ? DOM.compareTypes1 : DOM.compareTypes2;

      const types = pokemon.types.map(t => t.type.name);
      const spriteUrl = api.getSpriteUrl(id);
      const fallback = api.getSpriteFallback(id);

      imgEl.src = spriteUrl;
      imgEl.onerror = () => { imgEl.src = fallback; };
      imgEl.alt = pokemon.name;
      nameEl.textContent = capitalize(pokemon.name);
      typesEl.innerHTML = types.map(t => typeBadge(t)).join('');

      emptyEl.classList.add('hidden');
      selectedEl.classList.remove('hidden');

      renderCompareTable();
    } catch (err) {
      console.error('Compare select error:', err);
      showToast('Failed to load Pokémon');
    }
  }

  function clearCompareSlot(slotIndex) {
    state.compareSlot[slotIndex] = null;

    const emptyEl = slotIndex === 0 ? DOM.pickerEmpty1 : DOM.pickerEmpty2;
    const selectedEl = slotIndex === 0 ? DOM.pickerSelected1 : DOM.pickerSelected2;
    const searchEl = slotIndex === 0 ? DOM.compareSearch1 : DOM.compareSearch2;
    const resultsEl = slotIndex === 0 ? DOM.compareResults1 : DOM.compareResults2;

    emptyEl.classList.remove('hidden');
    selectedEl.classList.add('hidden');
    if (searchEl) searchEl.value = '';
    if (resultsEl) resultsEl.innerHTML = '';

    DOM.compareTable.classList.add('hidden');
  }

  function renderCompareTable() {
    const [p1, p2] = state.compareSlot;
    if (!p1 || !p2) {
      DOM.compareTable.classList.add('hidden');
      return;
    }

    DOM.compareTable.classList.remove('hidden');

    const stats1 = {};
    const stats2 = {};
    p1.stats.forEach(s => { stats1[s.stat.name] = s.base_stat; });
    p2.stats.forEach(s => { stats2[s.stat.name] = s.base_stat; });

    const statNames = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];

    const total1 = statNames.reduce((s, n) => s + (stats1[n] || 0), 0);
    const total2 = statNames.reduce((s, n) => s + (stats2[n] || 0), 0);

    const rows = [
      { label: 'Height', v1: (p1.height / 10).toFixed(1) + 'm', v2: (p2.height / 10).toFixed(1) + 'm', raw1: p1.height, raw2: p2.height },
      { label: 'Weight', v1: (p1.weight / 10).toFixed(1) + 'kg', v2: (p2.weight / 10).toFixed(1) + 'kg', raw1: p1.weight, raw2: p2.weight },
      { label: 'Base EXP', v1: p1.base_experience || '—', v2: p2.base_experience || '—', raw1: p1.base_experience, raw2: p2.base_experience },
      ...statNames.map(n => ({
        label: statLabel(n),
        v1: stats1[n] || 0,
        v2: stats2[n] || 0,
        raw1: stats1[n] || 0,
        raw2: stats2[n] || 0,
      })),
      { label: 'Total', v1: total1, v2: total2, raw1: total1, raw2: total2 },
    ];

    DOM.compareTable.innerHTML = rows.map(row => {
      const w1 = row.raw1 > row.raw2 ? 'winner' : '';
      const w2 = row.raw2 > row.raw1 ? 'winner' : '';
      return `
        <div class="compare-row">
          <div class="compare-row-val left ${w1}">${row.v1}</div>
          <div class="compare-row-label">${row.label}</div>
          <div class="compare-row-val right ${w2}">${row.v2}</div>
        </div>
      `;
    }).join('');
  }

  /* ==========================================
     SETTINGS
     ========================================== */

  function updateSettingsPage() {
    DOM.favCount.textContent = `${state.favorites.length} Pokémon saved`;
    DOM.teamCount.textContent = `${state.team.length} Pokémon in team`;
    DOM.cacheCount.textContent = `${api.cacheCount()} entries cached`;
  }

  /* ==========================================
     CUSTOM SELECT DROPDOWNS
     ========================================== */

  function initCustomSelects() {
    const selects = document.querySelectorAll('.filter-select');
    selects.forEach(select => {
      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select';
      wrapper.dataset.selectId = select.id;
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);

      // Build trigger
      const trigger = document.createElement('div');
      trigger.className = 'custom-select-trigger';
      const chevron = `<svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      trigger.innerHTML = `<span>${select.options[select.selectedIndex]?.text || ''}</span>${chevron}`;
      wrapper.appendChild(trigger);

      // Build panel
      const panel = document.createElement('div');
      panel.className = 'custom-select-panel';
      wrapper.appendChild(panel);

      function buildOptions() {
        panel.innerHTML = '';
        Array.from(select.options).forEach(opt => {
          const item = document.createElement('div');
          item.className = 'custom-select-option' + (opt.value === select.value ? ' selected' : '');
          item.dataset.value = opt.value;
          item.innerHTML = `<span class="opt-dot"></span><span>${opt.text}</span>`;
          item.addEventListener('click', () => {
            select.value = opt.value;
            select.dispatchEvent(new Event('change'));
            trigger.querySelector('span').textContent = opt.text;
            wrapper.classList.toggle('is-active', !!opt.value && opt.value !== 'id');
            closePanel();
          });
          panel.appendChild(item);
        });
      }

      function openPanel() {
        // Close all other panels first
        document.querySelectorAll('.custom-select.open').forEach(el => {
          if (el !== wrapper) el.classList.remove('open');
        });
        buildOptions();
        wrapper.classList.add('open');
      }

      function closePanel() {
        wrapper.classList.remove('open');
      }

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        wrapper.classList.contains('open') ? closePanel() : openPanel();
      });

      // Re-build when options are added dynamically (for type filter)
      const origDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      // Watch via MutationObserver for type options loading
      const observer = new MutationObserver(() => {
        if (wrapper.classList.contains('open')) buildOptions();
        trigger.querySelector('span').textContent = select.options[select.selectedIndex]?.text || '';
      });
      observer.observe(select, { childList: true });
    });

    // Close panels on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
    });
  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */

  function bindEvents() {

    // Navigation - sidebar
    DOM.sidebarNavItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        navigateTo(page);
        if (page === 'pokedex') loadPokedex();
        if (page === 'teams') renderTeamSlots();
      });
    });

    // Navigation - bottom
    DOM.bottomNavItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        navigateTo(page);
        if (page === 'pokedex') loadPokedex();
        if (page === 'teams') renderTeamSlots();
      });
    });

    // Section links and quick nav
    document.querySelectorAll('[data-page]').forEach(el => {
      if (el.classList.contains('nav-item') || el.classList.contains('bottom-nav-item')) return;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const page = el.dataset.page;
        navigateTo(page);
        if (page === 'pokedex') loadPokedex();
      });
    });

    // Theme
    DOM.themeToggle?.addEventListener('click', toggleTheme);
    DOM.darkModeToggle?.addEventListener('change', toggleTheme);

    // Sidebar expand — tablet mode (768px–1023px)
    // Klik pokeball logo → buka; klik overlay → tutup; klik nav item → tutup
    (function initTabletSidebar() {
      const sidebar = DOM.sidebar;
      const overlay = DOM.sidebarOverlay;
      if (!sidebar || !overlay) return;

      function isTablet() {
        return window.innerWidth >= 768 && window.innerWidth <= 1023;
      }

      function openSidebar() {
        sidebar.classList.add('sidebar--expanded');
        overlay.classList.add('active');
      }

      function closeSidebar() {
        sidebar.classList.remove('sidebar--expanded');
        overlay.classList.remove('active');
      }

      // Klik pokeball (brand-ball SVG di dalam sidebar-logo)
      const brandBall = sidebar.querySelector('.sidebar-logo .brand-ball');
      brandBall?.addEventListener('click', (e) => {
        if (!isTablet()) return;
        e.stopPropagation();
        if (sidebar.classList.contains('sidebar--expanded')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });

      // Klik overlay → tutup
      overlay.addEventListener('click', closeSidebar);

      // Klik nav item → tutup (navigasi + close)
      DOM.sidebarNavItems.forEach(item => {
        item.addEventListener('click', () => {
          if (isTablet()) closeSidebar();
        });
      });

      // Resize → pastikan state bersih kalau bukan tablet lagi
      window.addEventListener('resize', () => {
        if (!isTablet()) closeSidebar();
      });
    })();

    // Home search
    DOM.homeSearch?.addEventListener('input', debounce((e) => {
      const q = e.target.value.trim();
      if (!q) return;
      state.searchQuery = q;
      navigateTo('pokedex');
      loadPokedex().then(() => {
        DOM.pokedexSearch.value = q;
        applyFiltersAndRender();
      });
    }, 400));

    // Pokédex search — with clear (×) button
    (function initSearchClear() {
      const input = DOM.pokedexSearch;
      if (!input) return;

      // Inject clear button into the search-wrap
      const wrap = input.closest('.search-wrap');
      if (!wrap) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'search-clear-btn hidden';
      btn.setAttribute('aria-label', 'Clear search');
      btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';

      wrap.appendChild(btn);

      function syncClearBtn() {
        btn.classList.toggle('hidden', !input.value);
      }

      function clearSearch() {
        input.value = '';
        state.searchQuery = '';
        syncClearBtn();
        input.focus();
        applyFiltersAndRender();
      }

      input.addEventListener('input', syncClearBtn);
      btn.addEventListener('click', clearSearch);

      // Keep in sync if search is set programmatically (e.g. from home search)
      const origDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      Object.defineProperty(input, 'value', {
        get() { return origDescriptor.get.call(this); },
        set(v) { origDescriptor.set.call(this, v); syncClearBtn(); },
        configurable: true,
      });
    })();

    DOM.pokedexSearch?.addEventListener('input', debounce((e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      state.isFavoritesMode = false;
      applyFiltersAndRender();
    }, 300));

    // Filters
    DOM.filterType?.addEventListener('change', (e) => {
      state.filterType = e.target.value;
      state.isFavoritesMode = false;
      e.target.classList.toggle('is-active', !!e.target.value);
      applyFiltersAndRender();
    });

    DOM.filterGen?.addEventListener('change', (e) => {
      state.filterGen = e.target.value;
      state.isFavoritesMode = false;
      e.target.classList.toggle('is-active', !!e.target.value);
      applyFiltersAndRender();
    });

    DOM.sortBy?.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      state.isFavoritesMode = false;
      e.target.classList.toggle('is-active', e.target.value !== 'id');
      applyFiltersAndRender();
    });

    DOM.sortDirBtn?.addEventListener('click', () => {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      DOM.sortDirBtn.classList.toggle('desc', state.sortDir === 'desc');
      applyFiltersAndRender();
    });

    // Load more button hidden — replaced by infinite scroll
    DOM.loadMoreBtn.style.display = 'none';

    // Modal close
    DOM.modalClose?.addEventListener('click', closeModal);
    DOM.modalOverlay?.addEventListener('click', (e) => {
      if (e.target === DOM.modalOverlay) closeModal();
    });

    // Keyboard close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeConfirm(false);
      }
    });

    // Confirm dialog buttons
    DOM.confirmOk?.addEventListener('click', () => closeConfirm(true));
    DOM.confirmCancel?.addEventListener('click', () => closeConfirm(false));
    DOM.confirmOverlay?.addEventListener('click', (e) => {
      if (e.target === DOM.confirmOverlay) closeConfirm(false);
    });

    // Modal tabs
    DOM.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => renderModalTab(btn.dataset.tab));
    });

    // Modal fav & team
    DOM.modalFavBtn?.addEventListener('click', () => {
      if (!state.modalPokemon) return;
      toggleFavorite(state.modalPokemon.id, null);
    });

    DOM.modalTeamBtn?.addEventListener('click', async () => {
      if (!state.modalPokemon) return;
      const p = state.modalPokemon;
      const inTeam = state.team.some(t => t.id === p.id);
      if (inTeam) {
        showToast(`${capitalize(p.name)} is already in your team!`);
        return;
      }
      addToTeam({ id: p.id, name: p.name, types: p.types });
    });

    // Teams
    DOM.clearTeamBtn?.addEventListener('click', () => {
      state.team = [];
      lsSet('p2dex-team', []);
      renderTeamSlots();
      showToast('Team cleared');
    });

    DOM.teamSearch?.addEventListener('input', debounce(async (e) => {
      const q = e.target.value.trim().toLowerCase();
      DOM.teamSearchGrid.innerHTML = '';
      if (!q) return;

      // Need allPokemon loaded
      if (state.allPokemon.length === 0) {
        const data = await api.getPokemonList(1025, 0);
        state.allPokemon = data.results.map((p, i) => ({ id: i + 1, name: p.name }));
      }

      const matches = state.allPokemon
        .filter(p => p.name.includes(q) || String(p.id).includes(q))
        .slice(0, 12);

      const fetched = await Promise.all(matches.map(p => api.getPokemon(p.id).catch(() => null)));
      fetched.forEach(pokemon => {
        if (!pokemon) return;
        const card = renderCard(
          { id: pokemon.id, name: pokemon.name, types: pokemon.types },
          { addToTeam: true }
        );
        DOM.teamSearchGrid.appendChild(card);
      });
    }, 400));

    // Compare
    DOM.compareSearch1?.addEventListener('input', debounce(async (e) => {
      if (state.allPokemon.length === 0) {
        const data = await api.getPokemonList(1025, 0);
        state.allPokemon = data.results.map((p, i) => ({ id: i + 1, name: p.name }));
      }
      searchForCompare(e.target.value, 0);
    }, 300));

    DOM.compareSearch2?.addEventListener('input', debounce(async (e) => {
      if (state.allPokemon.length === 0) {
        const data = await api.getPokemonList(1025, 0);
        state.allPokemon = data.results.map((p, i) => ({ id: i + 1, name: p.name }));
      }
      searchForCompare(e.target.value, 1);
    }, 300));

    document.querySelectorAll('.picker-clear').forEach(btn => {
      btn.addEventListener('click', () => clearCompareSlot(parseInt(btn.dataset.slot) - 1));
    });

    // Settings
    DOM.clearFavBtn?.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: 'Clear Favorites?',
        desc: `You have ${state.favorites.length} Pokémon saved. This action cannot be undone.`,
        okLabel: 'Clear',
      });
      if (!ok) return;
      state.favorites = [];
      lsSet('p2dex-favorites', []);
      showToast('Favorites cleared');
      updateSettingsPage();
    });

    document.getElementById('viewFavBtn')?.addEventListener('click', async () => {
      if (state.favorites.length === 0) {
        showToast('No favorites yet! ❤️');
        return;
      }
      await enterFavoritesMode();
    });

    DOM.clearTeamSettingsBtn?.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: 'Clear Team?',
        desc: `Your current team of ${state.team.length} Pokémon will be removed. This action cannot be undone.`,
        okLabel: 'Clear',
      });
      if (!ok) return;
      state.team = [];
      lsSet('p2dex-team', []);
      showToast('Team cleared');
      updateSettingsPage();
    });

    DOM.clearCacheBtn?.addEventListener('click', () => {
      api.clearCache();
      showToast('Cache cleared');
      updateSettingsPage();
    });

    DOM.clearAllBtn?.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: 'Reset All Data?',
        desc: 'This will clear your favorites, team, API cache, and theme preference. This action cannot be undone.',
        okLabel: 'Reset All',
      });
      if (!ok) return;
      state.favorites = [];
      state.team = [];
      state.allPokemon = [];
      lsRemove('p2dex-favorites');
      lsRemove('p2dex-team');
      api.clearCache();
      applyTheme('light');
      showToast('All data reset');
      updateSettingsPage();
    });

    // Favorites quick button
    document.getElementById('favoritesQuickBtn')?.addEventListener('click', async () => {
      if (state.favorites.length === 0) {
        showToast('No favorites yet! ❤️');
        return;
      }
      await enterFavoritesMode();
    });
  }

  /* ==========================================
     LOADING SCREEN
     ========================================== */

  function initLoadingScreen() {
    const screen  = document.getElementById('loading-screen');
    const barFill = document.getElementById('lsBarFill');
    const barLabel = document.getElementById('lsBarLabel');
    if (!screen) return Promise.resolve();

    const steps = [
      { pct: 20, label: 'Waking up Pokémon…' },
      { pct: 45, label: 'Fetching Pokédex data…' },
      { pct: 70, label: 'Preparing your team…' },
      { pct: 90, label: 'Almost ready…' },
      { pct: 100, label: 'Welcome, Trainer!' },
    ];

    // Minimum display time so the screen isn't just a flash
    const MIN_MS = 1800;
    const start = Date.now();

    function setBar(pct, label) {
      if (barFill)  barFill.style.width  = pct + '%';
      if (barLabel) barLabel.textContent = label;
    }

    // Step through the bar on a schedule
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < steps.length) {
        setBar(steps[idx].pct, steps[idx].label);
        idx++;
      } else {
        clearInterval(interval);
      }
    }, MIN_MS / (steps.length + 1));

    return new Promise(resolve => {
      setTimeout(() => {
        clearInterval(interval);
        setBar(100, 'Welcome, Trainer!');
        setTimeout(() => {
          screen.classList.add('ls-hidden');
          // Remove from DOM after transition ends
          screen.addEventListener('transitionend', () => screen.remove(), { once: true });
          resolve();
        }, 250); // short pause on 100% before fade
      }, Math.max(MIN_MS, Date.now() - start));
    });
  }

  /* ==========================================
     INIT
     ========================================== */

  async function init() {
    applyTheme(state.theme);
    initCustomSelects();
    bindEvents();

    // Run loading screen + app init in parallel
    await Promise.all([
      initLoadingScreen(),
      (async () => {
        await loadHomePage();
        renderTeamSlots();
      })(),
    ]);
  }

  init();

})();