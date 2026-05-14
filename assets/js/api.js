/* ==========================================
   API.JS — PokéAPI Fetch Logic & Caching
   ========================================== */

window.P2Dex = window.P2Dex || {};

P2Dex.api = (function () {

  const BASE = 'https://pokeapi.co/api/v2';
  const CACHE_KEY = 'p2dex-cache';

  /* ---- Local helper ---- */
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* ---- In-memory cache ---- */
  let _cache = {};

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) _cache = JSON.parse(raw);
    } catch {
      _cache = {};
    }
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(_cache));
    } catch {
      // Storage might be full; silently skip
    }
  }

  function clearCache() {
    _cache = {};
    localStorage.removeItem(CACHE_KEY);
  }

  function cacheCount() {
    return Object.keys(_cache).length;
  }

  async function fetchJson(url) {
    if (_cache[url]) return _cache[url];
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const data = await res.json();
    _cache[url] = data;
    saveCache();
    return data;
  }

  /* ---- Get list of Pokémon (minimal) ---- */
  async function getPokemonList(limit = 30, offset = 0) {
    const url = `${BASE}/pokemon?limit=${limit}&offset=${offset}`;
    const data = await fetchJson(url);
    return data;
  }

  /* ---- Get Pokémon detail ---- */
  async function getPokemon(nameOrId) {
    const url = `${BASE}/pokemon/${nameOrId}`;
    return await fetchJson(url);
  }

  /* ---- Get species (for description, evolution url) ---- */
  async function getSpecies(nameOrId) {
    const url = `${BASE}/pokemon-species/${nameOrId}`;
    return await fetchJson(url);
  }

  /* ---- Get evolution chain ---- */
  async function getEvolutionChain(url) {
    return await fetchJson(url);
  }

  /* ---- Get ability detail ---- */
  async function getAbility(url) {
    return await fetchJson(url);
  }

  /* ---- Get type list ---- */
  async function getTypeList() {
    const url = `${BASE}/type?limit=20`;
    const data = await fetchJson(url);
    return data.results.filter(t => t.name !== 'unknown' && t.name !== 'shadow');
  }

  /* ---- Helper: get sprite URL ---- */
  function getSpriteUrl(id) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }

  function getSpriteFallback(id) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  }

  /* ---- Parse english flavor text from species ---- */
  function getEnglishFlavorText(species) {
    const entry = (species.flavor_text_entries || []).find(e => e.language.name === 'en');
    if (!entry) return '';
    return entry.flavor_text.replace(/\f|\n/g, ' ').trim();
  }

  /* ---- Parse evolution chain into tree structure ---- */
  function parseEvolutionChain(chain) {
    // Returns tree: { name, id, details, evolvesTo: [...] }
    // details = evolution_details array from the child node (how it evolves FROM parent)
    function walkTree(node, details) {
      const name = node.species.name;
      const id = parseInt(node.species.url.split('/').filter(Boolean).pop());
      return {
        name,
        id,
        details: details || [],  // how THIS pokemon was evolved into
        evolvesTo: (node.evolves_to || []).map(child => walkTree(child, child.evolution_details)),
      };
    }
    return walkTree(chain.chain, []);
  }

  /* ---- Format evolution trigger label from details ---- */
  function formatEvoTrigger(details) {
    if (!details || details.length === 0) return null;
    const d = details[0]; // use first detail set
    const trigger = d.trigger?.name;

    // Level up
    if (trigger === 'level-up') {
      if (d.min_level) return `Lv. ${d.min_level}`;
      if (d.min_happiness) return `Happiness ≥ ${d.min_happiness}`;
      if (d.min_beauty) return `Beauty ≥ ${d.min_beauty}`;
      if (d.min_affection) return `Affection ≥ ${d.min_affection}`;
      if (d.known_move) return `Know ${capitalize(d.known_move.name)}`;
      if (d.known_move_type) return `Know ${capitalize(d.known_move_type.name)}-type`;
      if (d.location) return `At location`;
      if (d.time_of_day) return d.time_of_day === 'day' ? 'Daytime' : d.time_of_day === 'night' ? 'Nighttime' : capitalize(d.time_of_day);
      if (d.held_item) return `Hold ${capitalize(d.held_item.name.replace(/-/g,' '))}`;
      if (d.needs_overworld_rain) return 'Rain';
      if (d.turn_upside_down) return 'Upside down';
      return 'Level up';
    }

    // Use item (stones etc)
    if (trigger === 'use-item') {
      const item = d.item?.name || '';
      return capitalize(item.replace(/-/g, ' '));
    }

    // Trade
    if (trigger === 'trade') {
      if (d.held_item) return `Trade w/ ${capitalize(d.held_item.name.replace(/-/g,' '))}`;
      if (d.trade_species) return `Trade for ${capitalize(d.trade_species.name)}`;
      return 'Trade';
    }

    // Shed (Nincada → Shedinja)
    if (trigger === 'shed') return 'Shed';

    // Spin (Milcery)
    if (trigger === 'spin') return 'Spin';

    // Tower of darkness/waters
    if (trigger === 'tower-of-darkness') return 'Tower of Darkness';
    if (trigger === 'tower-of-waters') return 'Tower of Waters';

    // Agile/strong style
    if (trigger === 'agile-style-move') return 'Agile Style';
    if (trigger === 'strong-style-move') return 'Strong Style';

    // Recoil damage
    if (trigger === 'take-damage') return 'Take damage';

    return capitalize(trigger?.replace(/-/g, ' ') || '');
  }

  /* ---- Flat walk (kept for backward compat, used internally) ---- */
  function parseEvolutionChainFlat(chain) {
    const results = [];
    function walk(node) {
      const name = node.species.name;
      const id = parseInt(node.species.url.split('/').filter(Boolean).pop());
      results.push({ name, id });
      if (node.evolves_to && node.evolves_to.length > 0) {
        walk(node.evolves_to[0]);
      }
    }
    walk(chain.chain);
    return results;
  }

  /* ---- Generation ranges ---- */
  const GEN_RANGES = {
    '1': [1, 151],
    '2': [152, 251],
    '3': [252, 386],
    '4': [387, 493],
    '5': [494, 649],
    '6': [650, 721],
    '7': [722, 809],
    '8': [810, 905],
    '9': [906, 1025],
  };

  function inGenRange(id, gen) {
    const range = GEN_RANGES[gen];
    if (!range) return true;
    return id >= range[0] && id <= range[1];
  }

  // init
  loadCache();

  return {
    getPokemonList,
    getPokemon,
    getSpecies,
    getEvolutionChain,
    getAbility,
    getTypeList,
    getSpriteUrl,
    getSpriteFallback,
    getEnglishFlavorText,
    parseEvolutionChain,
    parseEvolutionChainFlat,
    formatEvoTrigger,
    inGenRange,
    clearCache,
    cacheCount,
    GEN_RANGES,
  };

})();