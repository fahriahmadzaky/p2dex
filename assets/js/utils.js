/* ==========================================
   UTILS.JS — Helper Functions
   ========================================== */

window.P2Dex = window.P2Dex || {};

P2Dex.utils = (function () {

  /* ---- Type Colors ---- */
  const TYPE_COLORS = {
    normal:   '#A8A77A',
    fire:     '#EE8130',
    water:    '#6390F0',
    electric: '#F7D02C',
    grass:    '#7AC74C',
    ice:      '#96D9D6',
    fighting: '#C22E28',
    poison:   '#A33EA1',
    ground:   '#E2BF65',
    flying:   '#A98FF3',
    psychic:  '#F95587',
    bug:      '#A6B91A',
    rock:     '#B6A136',
    ghost:    '#735797',
    dragon:   '#6F35FC',
    dark:     '#705746',
    steel:    '#B7B7CE',
    fairy:    '#D685AD',
  };

  function getTypeColor(type) {
    return TYPE_COLORS[type.toLowerCase()] || '#777';
  }

  /* ---- Type Badge HTML ---- */
  function typeBadge(type, extraClass = '') {
    const color = getTypeColor(type);
    return `<span class="type-badge ${extraClass}" style="background:${color}">${type}</span>`;
  }

  /* ---- Pad ID ---- */
  function padId(id) {
    return '#' + String(id).padStart(4, '0');
  }

  /* ---- Capitalize ---- */
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
  }

  /* ---- Debounce ---- */
  function debounce(fn, ms = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /* ---- LocalStorage helpers ---- */
  function lsGet(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function lsRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  /* ---- Stat Colors ---- */
  function statColor(value) {
    if (value >= 120) return '#4CAF50';
    if (value >= 80)  return '#8BC34A';
    if (value >= 50)  return '#FFC107';
    if (value >= 30)  return '#FF9800';
    return '#F44336';
  }

  /* ---- Show Toast ---- */
  function showToast(msg, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(P2Dex._toastTimer);
    P2Dex._toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  /* ---- Stat label short names ---- */
  const STAT_LABELS = {
    hp:               'HP',
    attack:           'ATK',
    defense:          'DEF',
    'special-attack':  'SpATK',
    'special-defense': 'SpDEF',
    speed:            'SPD',
  };

  function statLabel(name) {
    return STAT_LABELS[name] || capitalize(name);
  }

  return {
    getTypeColor,
    typeBadge,
    padId,
    capitalize,
    debounce,
    lsGet,
    lsSet,
    lsRemove,
    statColor,
    showToast,
    statLabel,
  };

})();