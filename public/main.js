// public/main.js
(() => {
  'use strict';
  // ─── CONFIG ─────────────────────────────────────────────────────────────
  const SPRITE64 = 'images/sprite64.png';       // 64×64 atlas
  const SPRITE256_BASE = 'images/256';                // folder for 256×256 files
  const TILE = 64;
  const MAX_TILE_SCALE = 2.5;                        // renamed for consistency

  // ─── STATE ──────────────────────────────────────────────────────────────
  let meta = [], sprite64;
  let minX, maxX, minY, maxY, gridW, gridH;
  let scale = 1, targetScale = 1;
  let offX = 0, offY = 0, targetOffX = 0, targetOffY = 0;

  const selected = new Set();
  const matched = new Set();
  const walletHoldings = new Map(); // Map of wallet address -> Set of token IDs
  const filters = {};
  let colorMap = {};
  let walletColors = new Map(); // Map of wallet address -> color

  // ─── DOM NODES ──────────────────────────────────────────────────────────
  const canvas = document.getElementById('canvas'),
    ctx = canvas.getContext('2d'),
    zoomIn = document.getElementById('zoomIn'),
    zoomOut = document.getElementById('zoomOut'),
    zoomLv = document.getElementById('zoomLv'),
    panel = document.getElementById('panel'),
    toggle = document.getElementById('filterToggle'),
    activeDiv = document.getElementById('active'),
    shadeToggle = document.getElementById('shadeToggle'),
    overlay = document.getElementById('overlay'),
    overlayImg = document.getElementById('overlayImg'),
    popupMeta = document.getElementById('popupMeta'),
    backBtn = document.getElementById('backBtn'),
    themeSelector = document.getElementById('themeSelector'),
    themeSelectorMobile = document.getElementById('themeSelectorMobile'),
    loadingEl = document.getElementById('loading'),
    mobileMenuToggle = document.getElementById('mobileMenuToggle'),
    mobileMenu = document.getElementById('mobileMenu'),
    fullscreenOverlay = document.getElementById('fullscreenOverlay'),
    fullscreenImage = document.getElementById('fullscreenImage');

  // ─── THEME MANAGEMENT ──────────────────────────────────────────────────
  function initTheme() {
    let savedTheme = localStorage.getItem('meturferse-theme');
    
    // If no saved theme (new user), select random theme
    if (!savedTheme) {
      const themes = [
        'light', 'dark', 'pixel-forest', 'cyberpunk', 'ocean-depths', 
        'desert-sunset', 'arctic-frost', 'retro-terminal', 'royal-purple', 
        'minimalist-mono', 'pastel-dream', 'industrial-steel', 'cosmic-space'
      ];
      savedTheme = themes[Math.floor(Math.random() * themes.length)];
      localStorage.setItem('meturferse-theme', savedTheme);
    }
    
    setTheme(savedTheme);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('meturferse-theme', theme);
    
    // Update theme selectors
    if (themeSelector) {
      themeSelector.value = theme;
    }
    if (themeSelectorMobile) {
      themeSelectorMobile.value = theme;
    }
    
    // Only call draw if canvas is available (DOM ready)
    if (typeof draw === 'function' && canvas && ctx) {
      draw(); // Redraw with new theme colors
    }
  }

  function handleThemeChange(event) {
    const selectedTheme = event.target.value;
    const previousTheme = document.documentElement.getAttribute('data-theme');
    setTheme(selectedTheme);
    
    // Track theme change with method
    if (window.MixpanelTracker && previousTheme !== selectedTheme) {
      const method = event.target === themeSelectorMobile ? 'mobile-selector' : 'desktop-selector';
      window.MixpanelTracker.trackThemeChange(previousTheme, selectedTheme, method);
    }
    
    // Sync both selectors
    const otherSelector = event.target === themeSelector ? themeSelectorMobile : themeSelector;
    if (otherSelector) {
      otherSelector.value = selectedTheme;
    }
    
    // Close mobile menu if theme was changed from mobile
    if (event.target === themeSelectorMobile) {
      mobileMenu.classList.remove('show');
      mobileMenuToggle.classList.remove('active');
    }
  }

  // ─── FULL-SCREEN IMAGE FUNCTIONALITY ──────────────────────────────────
  function showFullscreenImage(imageSrc) {
    fullscreenImage.src = imageSrc;
    fullscreenOverlay.classList.add('show');
    fullscreenOverlay.style.display = 'flex';
    
    // Add escape key handler for fullscreen
    const handleFullscreenEscape = (e) => {
      if (e.key === 'Escape') {
        hideFullscreenImage();
      }
    };
    document.addEventListener('keydown', handleFullscreenEscape);
    
    // Click anywhere to close fullscreen
    const handleFullscreenClick = () => {
      hideFullscreenImage();
    };
    fullscreenOverlay.addEventListener('click', handleFullscreenClick);
    
    function hideFullscreenImage() {
      fullscreenOverlay.style.display = 'none';
      fullscreenOverlay.classList.remove('show');
      document.removeEventListener('keydown', handleFullscreenEscape);
      fullscreenOverlay.removeEventListener('click', handleFullscreenClick);
    }
  }

  // ─── URL STATE MANAGEMENT ──────────────────────────────────────────────
  function getStateFromURL() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    return {
      zoom: parseFloat(params.get('zoom')) || 1,
      x: parseFloat(params.get('x')) || 0,
      y: parseFloat(params.get('y')) || 0,
      filters: params.get('filters') ? JSON.parse(decodeURIComponent(params.get('filters'))) : {},
      wallets: params.get('wallets') ? JSON.parse(decodeURIComponent(params.get('wallets'))) : {}
    };
  }

  // Debounced URL update for high-frequency interactions
  let urlUpdateTimer = null;
  let lastUrlState = { zoom: 1, x: 0, y: 0 };
  
  function updateURL(immediate = false) {
    const walletData = {};
    walletHoldings.forEach((holdings, address) => {
      if (holdings.size > 0) {
        walletData[address] = Array.from(holdings);
      }
    });

    const state = {
      zoom: targetScale,
      x: targetOffX,
      y: targetOffY,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      wallets: Object.keys(walletData).length > 0 ? walletData : undefined
    };
    
    // For immediate updates (user-initiated actions)
    if (immediate) {
      performURLUpdate(state);
      return;
    }
    
    // Check if this is a meaningful change (for debounced updates)
    const zoomChanged = Math.abs(state.zoom - lastUrlState.zoom) > 0.05; // 5% zoom threshold
    const positionChanged = Math.abs(state.x - lastUrlState.x) > 10 || Math.abs(state.y - lastUrlState.y) > 10; // 10px threshold
    
    // If not meaningful, skip the update entirely
    if (!zoomChanged && !positionChanged) {
      return;
    }
    
    // Clear existing timer
    if (urlUpdateTimer) {
      clearTimeout(urlUpdateTimer);
    }
    
    // Set debounced timer (500ms delay)
    urlUpdateTimer = setTimeout(() => {
      performURLUpdate(state);
      lastUrlState = { zoom: state.zoom, x: state.x, y: state.y };
      urlUpdateTimer = null;
    }, 500);
  }
  
  function performURLUpdate(state) {
    const params = new URLSearchParams();
    if (state.zoom !== 1) params.set('zoom', state.zoom.toFixed(2));
    if (state.x !== 0) params.set('x', state.x.toFixed(0));
    if (state.y !== 0) params.set('y', state.y.toFixed(0));
    if (state.filters) params.set('filters', encodeURIComponent(JSON.stringify(state.filters)));
    if (state.wallets) params.set('wallets', encodeURIComponent(JSON.stringify(state.wallets)));
    
    const newHash = params.toString();
    if (window.location.hash.substring(1) !== newHash) {
      window.location.hash = newHash;
    }
  }

  // Service Worker removed - using standard HTTP caching instead

  function showUpdateNotification() {
    // Create a simple update notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      background: var(--accent);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px var(--shadow);
      z-index: 1000;
      font-size: 14px;
      cursor: pointer;
      animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
      <div>🚀 New version available!</div>
      <div style="font-size: 12px; margin-top: 4px;">Click to update</div>
    `;
    
    notification.onclick = () => {
      window.location.reload();
    };
    
    document.body.appendChild(notification);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  // ─── INITIAL LOAD ───────────────────────────────────────────────────────
  // Wait for DOM to be ready before initializing theme
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
  });
  
  Promise.all([
    fetch('metadata.json').then(r => r.json()),
    new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => {
        console.error('Failed to load sprite image');
        loadingEl.querySelector('.loading-text').textContent = 'Failed to load map data';
        res(null);
      };
      img.src = SPRITE64;
    })
  ]).then(([m, img]) => {
    if (!img) return;
    
    meta = m;
    sprite64 = img;
    
    // Track successful metadata and sprite loading
    if (window.MixpanelTracker) {
      window.MixpanelTracker.trackMetadataLoaded(m.length);
      window.MixpanelTracker.trackSpriteLoaded('sprite64', true);
    }
    // compute grid bounds
    const xs = meta.map(i => +i.attributes.find(t => t.trait_type === 'X.Coord').value),
      ys = meta.map(i => +i.attributes.find(t => t.trait_type === 'Y.Coord').value);
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
    gridW = maxX - minX + 1;
    gridH = maxY - minY + 1;

    buildFilters();
    initZoomPan();
    initMobileMenu();
    initNeighborhoodsTooltip();
    loadStateFromURL();
    window.addEventListener('resize', () => {
      draw();
      adjustPanelPosition();
    });
    window.addEventListener('hashchange', loadStateFromURL);
    
    // Hide loading screen
    loadingEl.style.display = 'none';
    draw();
    
    // Track app ready
    if (window.MixpanelTracker) {
      window.MixpanelTracker.trackAppReady();
    }
  }).catch(error => {
    console.error('Failed to initialize app:', error);
    loadingEl.querySelector('.loading-text').textContent = 'Failed to load application';
  });

  function loadStateFromURL() {
    const state = getStateFromURL();
    targetScale = state.zoom;
    targetOffX = state.x;
    targetOffY = state.y;
    scale = targetScale;
    offX = targetOffX;
    offY = targetOffY;
    
    // Restore filters
    if (Object.keys(state.filters).length > 0) {
      Object.assign(filters, state.filters);
    }
    applyFiltersFromState(); // Always call to ensure matched set is populated
    
    // Clear manual selections (no longer persisted)
    selected.clear();
    
    // Restore wallet holdings
    walletHoldings.clear();
    Object.entries(state.wallets).forEach(([address, holdings]) => {
      walletHoldings.set(address, new Set(holdings));
    });
    updateActiveWallets();
    
    zoomLv.textContent = `${Math.round(targetScale * 100)}%`;
    
    // Update mobile zoom level
    const zoomLvMobile = document.getElementById('zoomLvMobile');
    if (zoomLvMobile) {
      zoomLvMobile.textContent = `${Math.round(targetScale * 100)}%`;
    }
    
    if (sprite64) draw();
  }

  // ─── BUILD FILTER UI ────────────────────────────────────────────────────
  function buildFilters() {
    // Add general metadata search filter at the top
    const generalSearchDiv = document.createElement('div');
    generalSearchDiv.className = 'filter';
    const generalLbl = document.createElement('label');
    generalLbl.textContent = 'Search All Metadata';
    generalSearchDiv.append(generalLbl);
    
    const generalContainer = document.createElement('div');
    generalContainer.className = 'filter-input-container';
    const generalInput = document.createElement('input');
    generalInput.type = 'text';
    generalInput.placeholder = 'Search any metadata...';
    generalInput.maxLength = 32;
    generalInput.className = 'filter-text-input';
    
    const generalAddBtn = document.createElement('button');
    generalAddBtn.textContent = 'Add';
    generalAddBtn.className = 'filter-add-btn';
    generalAddBtn.onclick = () => {
      if (generalInput.value.trim()) {
        applyFilters();
        generalInput.value = '';
      }
    };
    
    generalInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (generalInput.value.trim()) {
          applyFilters();
          generalInput.value = '';
        }
      }
    };
    
    generalContainer.append(generalInput, generalAddBtn);
    generalSearchDiv.append(generalContainer);
    panel.append(generalSearchDiv);

    // Add plot type search filter
    const plotTypeDiv = document.createElement('div');
    plotTypeDiv.className = 'filter';
    const plotTypeLbl = document.createElement('label');
    plotTypeLbl.textContent = 'Plot Type Search';
    plotTypeDiv.append(plotTypeLbl);
    
    const plotTypeContainer = document.createElement('div');
    plotTypeContainer.className = 'filter-input-container';
    const plotTypeInput = document.createElement('input');
    plotTypeInput.type = 'text';
    plotTypeInput.placeholder = 'Search plot types...';
    plotTypeInput.maxLength = 32;
    plotTypeInput.className = 'filter-text-input';
    
    const plotTypeAddBtn = document.createElement('button');
    plotTypeAddBtn.textContent = 'Add';
    plotTypeAddBtn.className = 'filter-add-btn';
    plotTypeAddBtn.onclick = () => {
      if (plotTypeInput.value.trim()) {
        applyFilters();
        plotTypeInput.value = '';
      }
    };
    
    plotTypeInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (plotTypeInput.value.trim()) {
          applyFilters();
          plotTypeInput.value = '';
        }
      }
    };
    
    plotTypeContainer.append(plotTypeInput, plotTypeAddBtn);
    plotTypeDiv.append(plotTypeContainer);
    panel.append(plotTypeDiv);

    const info = {};
    meta.forEach(item => {
      item.attributes.forEach(t => {
        if (!info[t.trait_type]) info[t.trait_type] = { vals: new Set(), num: true };
        info[t.trait_type].vals.add(t.value);
        if (isNaN(Number(t.value))) info[t.trait_type].num = false;
      });
    });

    Object.entries(info).forEach(([trait, { vals, num }]) => {
      const div = document.createElement('div');
      div.className = 'filter';
      const lbl = document.createElement('label');
      lbl.textContent = trait;
      div.append(lbl);

      if (num) {
        const rangeDiv = document.createElement('div');
        rangeDiv.className = 'filter-range';
        ['min', 'max'].forEach(b => {
          const inp = document.createElement('input');
          inp.type = 'number';
          inp.placeholder = b === 'min' ? 'Min' : 'Max';
          inp.oninput = applyFilters;
          rangeDiv.append(inp);
        });
        div.append(rangeDiv);
      } else {
        const sel = document.createElement('select');
        sel.append(new Option('[all]', ''));
        Array.from(vals).sort().forEach(v => sel.append(new Option(v, v)));
        sel.onchange = applyFilters;
        div.append(sel);
      }

      panel.append(div);
    });
  }

  // ─── APPLY FILTERS ──────────────────────────────────────────────────────
  function applyFilters() {
    matched.clear();
    updateActiveFilters();

    // rebuild specs from UI
    const specs = {};
    let generalSearch = '';
    let plotTypeSearch = '';
    
    panel.querySelectorAll('.filter').forEach(div => {
      const trait = div.querySelector('label').textContent;
      const ctrls = div.querySelectorAll('input,select');
      
      // Handle special text search filters
      if (trait === 'Search All Metadata') {
        generalSearch = ctrls[0].value.toLowerCase().trim();
        if (generalSearch) specs['__generalSearch'] = generalSearch;
        return;
      }
      if (trait === 'Plot Type Search') {
        plotTypeSearch = ctrls[0].value.toLowerCase().trim();
        if (plotTypeSearch) specs['__plotTypeSearch'] = plotTypeSearch;
        return;
      }
      
      // Handle existing filters
      if (ctrls[0].tagName === 'SELECT') {
        if (ctrls[0].value) specs[trait] = ctrls[0].value;
      } else if (ctrls.length === 2) {
        const min = ctrls[0].value, max = ctrls[1].value;
        if (min || max) specs[trait] = { min, max };
      }
    });
    
    Object.assign(filters, specs);

    // collect matches
    // If no filters are active, match all items
    if (Object.keys(specs).length === 0 && !generalSearch && !plotTypeSearch) {
      // No filters active - don't highlight any plots
      // matched set remains empty
    } else {
      // Apply filters
      meta.forEach(item => {
        let ok = true;
        
        // Check general metadata search
        if (generalSearch) {
          const allValues = item.attributes.map(a => a.value.toString().toLowerCase()).join(' ');
          if (!allValues.includes(generalSearch)) {
            ok = false;
          }
        }
        
        // Check plot type search
        if (ok && plotTypeSearch) {
          const plotTypeAttr = item.attributes.find(a => a.trait_type === 'Plot Type');
          if (!plotTypeAttr || !plotTypeAttr.value.toLowerCase().includes(plotTypeSearch)) {
            ok = false;
          }
        }
        
        // Check existing filters
        if (ok) {
          for (const [t, c] of Object.entries(specs)) {
            if (t.startsWith('__')) continue; // Skip special search filters
            const attr = item.attributes.find(a => a.trait_type === t);
            if (!attr) { ok = false; break; }
            const v = attr.value;
            if (typeof c === 'string') {
              if (v !== c) { ok = false; break; }
            } else {
              if (c.min && +v < +c.min) { ok = false; break; }
              if (c.max && +v > +c.max) { ok = false; break; }
            }
          }
        }
        
        if (ok) matched.add(item.tokenId);
      });
    }

    updateActiveFilters();
    buildColorMap();
    shadeToggle.disabled = matched.size === 0;
    const shadeToggleMobile = document.getElementById('shadeToggleMobile');
    if (shadeToggleMobile) shadeToggleMobile.disabled = matched.size === 0;
    
    // Track filter application if any filters are active
    if (window.MixpanelTracker && Object.keys(specs).length > 0) {
      for (const [filterType, filterValue] of Object.entries(specs)) {
        if (filterType.startsWith('__')) {
          // Handle search filters
          const searchType = filterType === '__generalSearch' ? 'general' : 'plot-type';
          window.MixpanelTracker.trackSearchQuery(searchType, filterValue, matched.size);
        } else {
          // Handle regular filters
          window.MixpanelTracker.trackFilterApplied(filterType, filterValue, matched.size, 'manual');
        }
      }
    }
    
    updateURL(true); // Immediate - filter change
    draw();
    // Adjust panel position after filters change
    adjustPanelPosition();
  }
  
  function updateActiveFilters() {
    activeDiv.innerHTML = '';
    
    // Add filter chips
    Object.entries(filters).forEach(([t, c]) => {
      if (!c) return;
      const chip = document.createElement('div');
      chip.className = 'chip filter-chip';
      
      const text = document.createElement('span');
      
      // Handle special search filters
      if (t === '__generalSearch') {
        text.textContent = `Search All: "${c}"`;
      } else if (t === '__plotTypeSearch') {
        text.textContent = `Plot Type: "${c}"`;
      } else {
        text.textContent = typeof c === 'string'
          ? `${t}: ${c}`
          : `${t} ${c.min || '*'}-${c.max || '*'}`;
      }
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'chip-close';
      closeBtn.textContent = '✕';
      closeBtn.title = `Remove ${t.startsWith('__') ? 'search' : t} filter`;
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        removeFilter(t);
      };
      
      chip.appendChild(text);
      chip.appendChild(closeBtn);
      activeDiv.appendChild(chip);
    });
    
    // Add wallet chips
    updateActiveWallets();
  }

  function updateActiveWallets() {
    // Remove existing wallet chips
    activeDiv.querySelectorAll('.wallet-chip').forEach(chip => chip.remove());
    
    // Add wallet chips
    walletHoldings.forEach((holdings, walletAddress) => {
      if (holdings.size === 0) return;
      
      const chip = document.createElement('div');
      chip.className = 'chip wallet-chip';
      chip.style.backgroundColor = getWalletColor(walletAddress);
      chip.style.borderColor = getWalletColor(walletAddress);
      
      const text = document.createElement('span');
      const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      text.textContent = `👛 ${shortAddress} (${holdings.size})`;
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'chip-close';
      closeBtn.textContent = '✕';
      closeBtn.title = `Remove wallet ${shortAddress}`;
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        removeWallet(walletAddress);
      };
      
      chip.appendChild(text);
      chip.appendChild(closeBtn);
      activeDiv.appendChild(chip);
    });
    
    // Adjust panel position after chips change
    adjustPanelPosition();
  }

  function removeWallet(walletAddress) {
    walletHoldings.delete(walletAddress);
    walletColors.delete(walletAddress);
    updateActiveWallets();
    updateURL(true); // Immediate - wallet removal
    draw();
  }
  
  function removeFilter(trait) {
    delete filters[trait];
    // Clear the UI controls
    panel.querySelectorAll('.filter').forEach(div => {
      const labelText = div.querySelector('label').textContent;
      let matchesFilter = false;
      
      // Handle special search filters
      if (trait === '__generalSearch' && labelText === 'Search All Metadata') {
        matchesFilter = true;
      } else if (trait === '__plotTypeSearch' && labelText === 'Plot Type Search') {
        matchesFilter = true;
      } else if (labelText === trait) {
        matchesFilter = true;
      }
      
      if (matchesFilter) {
        const ctrls = div.querySelectorAll('input,select');
        ctrls.forEach(ctrl => {
          if (ctrl.tagName === 'SELECT') {
            ctrl.value = '';
          } else {
            ctrl.value = '';
          }
        });
      }
    });
    applyFilters();
  }
  
  function applyFiltersFromState() {
    // Update UI controls based on current filters state
    panel.querySelectorAll('.filter').forEach(div => {
      const trait = div.querySelector('label').textContent;
      let filterValue;
      
      // Handle special search filters
      if (trait === 'Search All Metadata') {
        filterValue = filters['__generalSearch'];
      } else if (trait === 'Plot Type Search') {
        filterValue = filters['__plotTypeSearch'];
      } else {
        filterValue = filters[trait];
      }
      
      if (!filterValue) return;
      
      const ctrls = div.querySelectorAll('input,select');
      if (ctrls[0].tagName === 'SELECT') {
        ctrls[0].value = filterValue;
      } else if (ctrls.length === 2) {
        // Range inputs (min/max)
        if (filterValue.min) ctrls[0].value = filterValue.min;
        if (filterValue.max) ctrls[1].value = filterValue.max;
      } else {
        // Text input (search filters)
        ctrls[0].value = filterValue;
      }
    });
    
    // Apply the filters using the same logic as applyFilters()
    matched.clear();
    
    let generalSearch = filters['__generalSearch'] ? filters['__generalSearch'].toLowerCase().trim() : '';
    let plotTypeSearch = filters['__plotTypeSearch'] ? filters['__plotTypeSearch'].toLowerCase().trim() : '';
    
    // Check if any filters are active
    const regularFilters = Object.keys(filters).filter(key => !key.startsWith('__'));
    const hasActiveFilters = regularFilters.length > 0 || generalSearch || plotTypeSearch;
    
    if (!hasActiveFilters) {
      // No filters active - don't highlight any plots
      // matched set remains empty
    } else {
      // Apply filters
      meta.forEach(item => {
        let ok = true;
        
        // Check general metadata search
        if (generalSearch) {
          const allValues = item.attributes.map(a => a.value.toString().toLowerCase()).join(' ');
          if (!allValues.includes(generalSearch)) {
            ok = false;
          }
        }
        
        // Check plot type search
        if (ok && plotTypeSearch) {
          const plotTypeAttr = item.attributes.find(a => a.trait_type === 'Plot Type');
          if (!plotTypeAttr || !plotTypeAttr.value.toLowerCase().includes(plotTypeSearch)) {
            ok = false;
          }
        }
        
        // Check regular filters
        if (ok) {
          for (const [t, c] of Object.entries(filters)) {
            if (t.startsWith('__')) continue; // Skip special search filters
            const attr = item.attributes.find(a => a.trait_type === t);
            if (!attr) { ok = false; break; }
            const v = attr.value;
            if (typeof c === 'string') {
              if (v !== c) { ok = false; break; }
            } else {
              if (c.min && +v < +c.min) { ok = false; break; }
              if (c.max && +v > +c.max) { ok = false; break; }
            }
          }
        }
        
        if (ok) matched.add(item.tokenId);
      });
    }
    
    updateActiveFilters();
    buildColorMap();
    shadeToggle.disabled = matched.size === 0;
    const shadeToggleMobile = document.getElementById('shadeToggleMobile');
    if (shadeToggleMobile) shadeToggleMobile.disabled = matched.size === 0;
  }

  // ─── COLOR MANAGEMENT ──────────────────────────────────────────────────────
  function buildColorMap() {
    const pts = Array.from(matched);
    const n = pts.length;
    colorMap = {};
    pts.forEach((tokenId, i) => {
      const hue = (i / n) * 360;
      colorMap[tokenId] = `hsla(${hue},70%,50%,0.3)`;
    });
  }

  const WALLET_COLORS = [
    '#10b981', // emerald-500
    '#f59e0b', // amber-500  
    '#8b5cf6', // violet-500
    '#ef4444', // red-500
    '#06b6d4', // cyan-500
    '#84cc16', // lime-500
    '#f97316', // orange-500
    '#ec4899', // pink-500
  ];

  function getWalletColor(walletAddress) {
    if (!walletColors.has(walletAddress)) {
      const colorIndex = walletColors.size % WALLET_COLORS.length;
      walletColors.set(walletAddress, WALLET_COLORS[colorIndex]);
    }
    return walletColors.get(walletAddress);
  }

  function getAllWalletHoldings() {
    const allHoldings = new Set();
    walletHoldings.forEach(holdings => {
      holdings.forEach(tokenId => allHoldings.add(tokenId));
    });
    return allHoldings;
  }

  // ─── DRAW ───────────────────────────────────────────────────────────────
  function draw() {
    if (!sprite64) return;
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ds = Math.min(scale, MAX_TILE_SCALE),
      mapW = gridW * TILE,
      mapH = gridH * TILE,
      tileSz = TILE * ds;

    ctx.drawImage(
      sprite64,
      0, 0, mapW, mapH,
      offX, offY, mapW * ds, mapH * ds
    );

    renderOverlay(tileSz);
    highlight(tileSz);
  }

  // ─── NEIGHBORHOODS OVERLAY ────────────────────────────────────────
  function renderOverlay(tileSz) {
    if (!shadeToggle.checked || !matched.size) return;

    const pts = Array.from(matched).map(tokenId => {
      const it = meta.find(i => i.tokenId === tokenId);
      return {
        tokenId,
        col: +it.attributes.find(t => t.trait_type === 'X.Coord').value - minX,
        row: maxY - +it.attributes.find(t => t.trait_type === 'Y.Coord').value
      };
    });

    // territory shading
    meta.forEach(item => {
      const x = +item.attributes.find(t => t.trait_type === 'X.Coord').value - minX;
      const y = maxY - +item.attributes.find(t => t.trait_type === 'Y.Coord').value;
      const dx = offX + x * tileSz;
      const dy = offY + y * tileSz;
      if (dx + tileSz < 0 || dy + tileSz < 0 || dx > canvas.width || dy > canvas.height) return;

      let minD = Infinity, count = 0, owner = null;
      pts.forEach(p => {
        const d = Math.abs(p.col - x) + Math.abs(p.row - y);
        if (d < minD) { minD = d; count = 1; owner = p.tokenId; }
        else if (d === minD) { count++; }
      });

      if (count === 1) {
        ctx.fillStyle = colorMap[owner];
        ctx.fillRect(dx, dy, tileSz, tileSz);
      } else {
        const g = Math.max(200 - 30 * (count - 2), 50);
        ctx.fillStyle = `rgba(${g},${g},${g},0.3)`;
        ctx.fillRect(dx, dy, tileSz, tileSz);
        
        // Draw count number in filter highlight color
        const filterHighlightColor = getComputedStyle(document.documentElement).getPropertyValue('--filter-highlight');
        ctx.fillStyle = filterHighlightColor;
        ctx.font = `bold ${Math.max(tileSz * 0.4, 12)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count.toString(), dx + tileSz / 2, dy + tileSz / 2);
      }
    });

    // stripes between adjacent matched
    const pairs = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1)
          pairs.push([a, b]);
      }
    }
    pairs.forEach(([p, q], i) => {
      const hue = (i / pairs.length) * 360;
      ctx.fillStyle = `hsla(${hue},80%,60%,0.5)`;
      if (p.row === q.row) {
        const mid = Math.min(p.col, q.col) + 0.5;
        const x = offX + mid * tileSz;
        const y = offY + p.row * tileSz;
        ctx.fillRect(x, y, 1, tileSz);
      } else {
        const mid = Math.min(p.row, q.row) + 0.5;
        const x = offX + p.col * tileSz;
        const y = offY + mid * tileSz;
        ctx.fillRect(x, y, tileSz, 1);
      }
    });
  }

  // ─── HIGHLIGHT ───────────────────────────────────────────────────────────
  function highlight(tileSz) {
    const allWalletHoldings = getAllWalletHoldings();
    
    // First draw filtered plots (using theme-specific filter highlight color)
    matched.forEach(id => {
      if (!allWalletHoldings.has(id)) { // Only if not a wallet holding
        const it = meta.find(i => i.tokenId === id);
        const x = +it.attributes.find(t => t.trait_type === 'X.Coord').value - minX;
        const y = maxY - +it.attributes.find(t => t.trait_type === 'Y.Coord').value;
        const dx = offX + x * tileSz, dy = offY + y * tileSz;
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--filter-highlight') || getComputedStyle(document.documentElement).getPropertyValue('--accent');
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, tileSz, tileSz);
      }
    });

    // Draw wallet holdings by wallet (each wallet gets its own color)
    walletHoldings.forEach((holdings, walletAddress) => {
      const color = getWalletColor(walletAddress);
      holdings.forEach(id => {
        const it = meta.find(i => i.tokenId === id);
        const x = +it.attributes.find(t => t.trait_type === 'X.Coord').value - minX;
        const y = maxY - +it.attributes.find(t => t.trait_type === 'Y.Coord').value;
        const dx = offX + x * tileSz, dy = offY + y * tileSz;
        
        // If this plot is both filtered AND wallet-owned, draw dual border
        if (matched.has(id)) {
          // Draw filter border first (inner)
          ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--filter-highlight') || getComputedStyle(document.documentElement).getPropertyValue('--accent');
          ctx.lineWidth = 2;
          ctx.strokeRect(dx + 1, dy + 1, tileSz - 2, tileSz - 2);
          
          // Draw wallet border (outer)
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(dx, dy, tileSz, tileSz);
        } else {
          // Just wallet border
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(dx, dy, tileSz, tileSz);
        }
      });
    });

    // Draw manually selected plots (black, thick stroke)
    selected.forEach(id => {
      if (!allWalletHoldings.has(id)) { // Only if not a wallet holding
        const it = meta.find(i => i.tokenId === id);
        const x = +it.attributes.find(t => t.trait_type === 'X.Coord').value - minX;
        const y = maxY - +it.attributes.find(t => t.trait_type === 'Y.Coord').value;
        const dx = offX + x * tileSz, dy = offY + y * tileSz;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeRect(dx, dy, tileSz, tileSz);
      }
    });
  }

  // ─── MOBILE MENU FUNCTIONALITY ─────────────────────────────────────────
  function adjustPanelPosition() {
    // Adjust filter panel position to account for dynamic header height including chips
    requestAnimationFrame(() => {
      const header = document.getElementById('header');
      const headerTotalHeight = header.offsetHeight;
      
      if (window.innerWidth <= 768) {
        const isMobileMenuOpen = mobileMenu.classList.contains('show');
        const isPanelOpen = panel.classList.contains('show');
        
        if (isMobileMenuOpen && isPanelOpen) {
          const mobileMenuHeight = mobileMenu.offsetHeight;
          const totalHeight = headerTotalHeight + mobileMenuHeight;
          panel.style.top = `${totalHeight}px`;
          panel.style.maxHeight = `calc(100vh - ${totalHeight}px)`;
          panel.style.zIndex = '1002'; // Ensure it's above everything
        } else {
          panel.style.top = `${headerTotalHeight}px`;
          panel.style.maxHeight = `calc(100vh - ${headerTotalHeight}px)`;
          panel.style.zIndex = '95';
        }
      } else {
        // Desktop: account for total header height including chips
        panel.style.top = `${headerTotalHeight}px`;
        panel.style.maxHeight = `calc(100vh - ${headerTotalHeight}px)`;
        panel.style.zIndex = '90';
      }
    });
  }

  function initMobileMenu() {
    // Mobile menu toggle
    mobileMenuToggle.onclick = () => {
      const isOpen = mobileMenu.classList.contains('show');
      if (isOpen) {
        mobileMenu.classList.remove('show');
        mobileMenuToggle.classList.remove('active');
      } else {
        mobileMenu.classList.add('show');
        mobileMenuToggle.classList.add('active');
      }
      // Adjust panel position after menu toggle
      setTimeout(adjustPanelPosition, 100);
    };

    // Synchronize mobile controls with desktop controls
    const syncZoomLevel = () => {
      const zoomLvMobile = document.getElementById('zoomLvMobile');
      if (zoomLvMobile) {
        zoomLvMobile.textContent = `${Math.round(targetScale * 100)}%`;
      }
    };

    // Mobile zoom controls
    document.getElementById('zoomInMobile').onclick = () => {
      targetScale = Math.min(targetScale * 1.2, 10);
      zoomLv.textContent = `${Math.round(targetScale * 100)}%`;
      syncZoomLevel();
      updateURL(true); // Immediate - mobile zoom in
      animate();
    };

    document.getElementById('zoomOutMobile').onclick = () => {
      targetScale = Math.max(targetScale / 1.2, 0.1);
      zoomLv.textContent = `${Math.round(targetScale * 100)}%`;
      syncZoomLevel();
      updateURL(true); // Immediate - mobile zoom out
      animate();
    };

    // Mobile filter toggle
    document.getElementById('filterToggleMobile').onclick = () => {
      panel.classList.toggle('show');
      const isShown = panel.classList.contains('show');
      toggle.setAttribute('aria-expanded', isShown);
      toggle.textContent = isShown ? '✕ Close' : 'Filters';
      document.getElementById('filterToggleMobile').textContent = isShown ? '✕ Close' : 'Filters';
      
      // Close mobile menu after action
      mobileMenu.classList.remove('show');
      mobileMenuToggle.classList.remove('active');
      
      // Adjust panel position
      setTimeout(adjustPanelPosition, 100);
    };

    // Mobile shade toggle
    document.getElementById('shadeToggleMobile').onchange = (e) => {
      shadeToggle.checked = e.target.checked;
      draw();
    };

    // Mobile theme selector
    if (themeSelectorMobile) {
      themeSelectorMobile.addEventListener('change', handleThemeChange);
    }

    // Mobile wallet functionality
    document.getElementById('walletBtnMobile').onclick = async () => {
      const addr = document.getElementById('walletInputMobile').value.trim();
      if (!addr) return;
      
      if (!ethers.isAddress(addr)) {
        return alert('Invalid ETH address');
      }
      try {
        await highlightWallet(addr);
        document.getElementById('walletInputMobile').value = '';
        // Close mobile menu after action
        mobileMenu.classList.remove('show');
        mobileMenuToggle.classList.remove('active');
      } catch (e) {
        console.error(e);
        alert('Failed to fetch holdings from Etherscan v2');
      }
    };

    // Mobile wallet input Enter key support
    document.getElementById('walletInputMobile').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('walletBtnMobile').click();
      }
    });

    // Sync shade toggle states
    shadeToggle.onchange = () => {
      const shadeToggleMobile = document.getElementById('shadeToggleMobile');
      if (shadeToggleMobile) {
        shadeToggleMobile.checked = shadeToggle.checked;
      }
      draw();
    };

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!mobileMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
        mobileMenu.classList.remove('show');
        mobileMenuToggle.classList.remove('active');
        adjustPanelPosition();
      }
    });

    // Close filter panel when clicking outside
    document.addEventListener('click', (e) => {
      // Only proceed if panel is open
      if (!panel.classList.contains('show')) return;
      
      const isClickInsidePanel = panel.contains(e.target);
      const isClickOnDesktopToggle = toggle.contains(e.target);
      const filterToggleMobile = document.getElementById('filterToggleMobile');
      const isClickOnMobileToggle = filterToggleMobile && filterToggleMobile.contains(e.target);
      
      // Also check if click is on any child of the toggle buttons
      const isClickOnToggle = isClickOnDesktopToggle || isClickOnMobileToggle ||
        (toggle && Array.from(toggle.children).some(child => child.contains(e.target))) ||
        (filterToggleMobile && Array.from(filterToggleMobile.children).some(child => child.contains(e.target)));
      
      // Close panel if clicking outside and not on any toggle button
      if (!isClickInsidePanel && !isClickOnToggle) {
        panel.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Filters';
        
        // Sync mobile filter toggle
        if (filterToggleMobile) {
          filterToggleMobile.textContent = 'Filters';
        }
        
        adjustPanelPosition();
      }
    }, true); // Use capture phase for better event handling
  }

  // ─── NEIGHBORHOODS TOOLTIP FUNCTIONALITY ─────────────────────────────────
  function initNeighborhoodsTooltip() {
    const shadeToggleDesktop = document.getElementById('shadeToggle');
    const shadeToggleMobileEl = document.getElementById('shadeToggleMobile');
    const shadeToggleLabel = document.querySelector('#shadeToggle + .shade-toggle-label');
    const shadeToggleLabelMobile = document.querySelector('#shadeToggleMobile + .shade-toggle-label');
    const tooltip = document.getElementById('neighborhoodsTooltip');
    const tooltipMobile = document.getElementById('neighborhoodsTooltipMobile');

    console.log('Initializing neighborhoods tooltip...', {
      shadeToggleDesktop: !!shadeToggleDesktop,
      shadeToggleLabel: !!shadeToggleLabel,
      tooltip: !!tooltip,
      shadeToggleMobileEl: !!shadeToggleMobileEl,
      shadeToggleLabelMobile: !!shadeToggleLabelMobile,
      tooltipMobile: !!tooltipMobile
    });

    // Desktop tooltip functionality
    if (shadeToggleDesktop && shadeToggleLabel && tooltip) {
      let hoverTimeout;
      
      shadeToggleLabel.addEventListener('mouseenter', () => {
        console.log('Desktop mouseenter - disabled:', shadeToggleDesktop.disabled);
        if (shadeToggleDesktop.disabled) {
          clearTimeout(hoverTimeout);
          hoverTimeout = setTimeout(() => {
            console.log('Showing desktop tooltip');
            tooltip.classList.add('show');
          }, 200); // Small delay to prevent flashing
        }
      });

      shadeToggleLabel.addEventListener('mouseleave', () => {
        console.log('Desktop mouseleave');
        clearTimeout(hoverTimeout);
        tooltip.classList.remove('show');
      });
    }

    // Mobile tooltip functionality (touch-based)
    if (shadeToggleMobileEl && shadeToggleLabelMobile && tooltipMobile) {
      let touchTimeout;
      
      shadeToggleLabelMobile.addEventListener('touchstart', (e) => {
        console.log('Mobile touchstart - disabled:', shadeToggleMobileEl.disabled);
        if (shadeToggleMobileEl.disabled) {
          e.preventDefault(); // Prevent default touch behavior
          clearTimeout(touchTimeout);
          console.log('Showing mobile tooltip');
          tooltipMobile.classList.add('show');
          
          // Auto-hide after 2 seconds on mobile
          touchTimeout = setTimeout(() => {
            tooltipMobile.classList.remove('show');
          }, 2000);
        }
      });

      // Hide tooltip when touching elsewhere
      document.addEventListener('touchstart', (e) => {
        if (!shadeToggleLabelMobile.contains(e.target)) {
          tooltipMobile.classList.remove('show');
          clearTimeout(touchTimeout);
        }
      });
    }

    // Hide tooltips when buttons become enabled (filters are applied)
    const originalApplyFilters = applyFilters;
    window.applyFilters = function() {
      originalApplyFilters.call(this);
      // Hide tooltips when shade toggle becomes enabled
      if (shadeToggleDesktop && !shadeToggleDesktop.disabled) {
        tooltip?.classList.remove('show');
        tooltipMobile?.classList.remove('show');
      }
    };
  }

  // ─── ZOOM, PAN, CLICK & DOUBLE-CLICK ────────────────────────────────────
  function initZoomPan() {
    zoomIn.onclick = () => { 
      const prevScale = targetScale;
      targetScale = Math.min(targetScale * 1.2, 10); 
      zoomLv.textContent = `${Math.round(targetScale * 100)}%`; 
      // Sync mobile zoom level
      const zoomLvMobile = document.getElementById('zoomLvMobile');
      if (zoomLvMobile) {
        zoomLvMobile.textContent = `${Math.round(targetScale * 100)}%`;
      }
      
      // Track zoom event
      if (window.MixpanelTracker) {
        window.MixpanelTracker.trackZoomEvent('in', prevScale, targetScale, 'button');
      }
      
      updateURL(true); // Immediate - desktop zoom in
      animate(); 
    };
    zoomOut.onclick = () => { 
      const prevScale = targetScale;
      targetScale = Math.max(targetScale / 1.2, 0.1); 
      zoomLv.textContent = `${Math.round(targetScale * 100)}%`; 
      // Sync mobile zoom level
      const zoomLvMobile = document.getElementById('zoomLvMobile');
      if (zoomLvMobile) {
        zoomLvMobile.textContent = `${Math.round(targetScale * 100)}%`;
      }
      
      // Track zoom event
      if (window.MixpanelTracker) {
        window.MixpanelTracker.trackZoomEvent('out', prevScale, targetScale, 'button');
      }
      
      updateURL(true); // Immediate - desktop zoom out
      animate(); 
    };
    toggle.onclick = () => {
      panel.classList.toggle('show');
      // Update button state
      const isShown = panel.classList.contains('show');
      toggle.setAttribute('aria-expanded', isShown);
      toggle.textContent = isShown ? '✕ Close' : 'Filters';
      // Sync mobile filter toggle
      const filterToggleMobile = document.getElementById('filterToggleMobile');
      if (filterToggleMobile) {
        filterToggleMobile.textContent = isShown ? '✕ Close' : 'Filters';
      }
      
      // Track filter panel toggle
      if (window.MixpanelTracker) {
        window.MixpanelTracker.trackFilterPanelToggle(isShown, 'desktop-button');
      }
      
      // Adjust panel position
      setTimeout(adjustPanelPosition, 100);
    };
    // Theme selector event listeners
    if (themeSelector) {
      themeSelector.addEventListener('change', handleThemeChange);
    }

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const isWheel = e.deltaMode === 1, isPinch = e.ctrlKey || e.metaKey;
      const r = canvas.getBoundingClientRect(),
        mx = e.clientX - r.left, my = e.clientY - r.top,
        wx = (mx - offX) / scale, wy = (my - offY) / scale;
      if (isWheel || isPinch) {
        const f = 1 - e.deltaY * 0.002;
        targetScale = Math.min(Math.max(targetScale * f, 0.1), 10);
        targetOffX = mx - wx * targetScale;
        targetOffY = my - wy * targetScale;
        zoomLv.textContent = `${Math.round(targetScale * 100)}%`;
      } else {
        targetOffX = offX - e.deltaX;
        targetOffY = offY - e.deltaY;
      }
      updateURL();
      animate();
    }, { passive: false });

    // Touch and mouse event handling
    let isDragging = false;
    let lastTouch = null;
    let isSelecting = false; // Prevent rapid multi-selection
    let mouseDragStart = null; // For mouse drag navigation
    
    // Multi-touch state for pinch-to-zoom
    let lastTouchDistance = null;
    let lastTouchCenter = null;
    let isPinching = false;
    
    // Helper function to calculate distance between two touch points
    function getTouchDistance(touches) {
      const touch1 = touches[0];
      const touch2 = touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Helper function to get center point between two touches
    function getTouchCenter(touches) {
      const touch1 = touches[0];
      const touch2 = touches[1];
      return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    }
    
    canvas.addEventListener('click', e => {
      if (isDragging || isSelecting) return; // Don't select if we were dragging or already selecting
      
      // Prevent rapid multiple selections with a longer timeout
      isSelecting = true;
      setTimeout(() => { 
        isSelecting = false; 
      }, 300);
      
      const r = canvas.getBoundingClientRect(),
        wx = (e.clientX - r.left - offX) / scale,
        wy = (e.clientY - r.top - offY) / scale,
        col = Math.floor(wx / TILE), row = Math.floor(wy / TILE),
        x = col + minX, y = maxY - row;
      const hit = meta.find(i =>
        +i.attributes.find(t => t.trait_type === 'X.Coord').value === x &&
        +i.attributes.find(t => t.trait_type === 'Y.Coord').value === y
      );
      
      if (!hit) return;
      
      // Only allow one manual selection at a time
      if (selected.has(hit.tokenId)) {
        selected.delete(hit.tokenId); // Deselect if already selected
      } else {
        selected.clear(); // Clear all previous selections first
        selected.add(hit.tokenId); // Add new selection
        
        // Track plot selection with full metadata
        if (window.MixpanelTracker) {
          window.MixpanelTracker.trackPlotSelection(hit.tokenId, { x, y }, 'click', hit);
        }
      }
      
      updateURL(true); // Immediate - plot selection
      draw();
    });
    
    // Add touch pan and pinch-zoom support
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        // Single touch - initialize pan
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isDragging = false;
        isPinching = false;
      } else if (e.touches.length === 2) {
        // Two touches - initialize pinch-to-zoom
        lastTouchDistance = getTouchDistance(e.touches);
        lastTouchCenter = getTouchCenter(e.touches);
        isPinching = true;
        isDragging = false;
        lastTouch = null; // Clear single touch state
      }
    }, { passive: true });
    
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && lastTouch && !isPinching) {
        // Single touch pan
        e.preventDefault();
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastTouch.x;
        const deltaY = touch.clientY - lastTouch.y;
        
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          isDragging = true;
        }
        
        targetOffX = offX + deltaX;
        targetOffY = offY + deltaY;
        lastTouch = { x: touch.clientX, y: touch.clientY };
        
        offX = targetOffX;
        offY = targetOffY;
        draw();
      } else if (e.touches.length === 2 && isPinching && lastTouchDistance && lastTouchCenter) {
        // Two touch pinch-to-zoom
        e.preventDefault();
        
        const currentDistance = getTouchDistance(e.touches);
        const currentCenter = getTouchCenter(e.touches);
        
        // Calculate zoom factor based on distance change
        const zoomFactor = currentDistance / lastTouchDistance;
        const newScale = Math.min(Math.max(targetScale * zoomFactor, 0.1), 10);
        
        // Calculate world coordinates of the pinch center
        const r = canvas.getBoundingClientRect();
        const centerX = currentCenter.x - r.left;
        const centerY = currentCenter.y - r.top;
        const worldX = (centerX - offX) / scale;
        const worldY = (centerY - offY) / scale;
        
        // Update scale and adjust offset to zoom around the pinch center
        targetScale = newScale;
        targetOffX = centerX - worldX * targetScale;
        targetOffY = centerY - worldY * targetScale;
        
        // Update zoom level display
        zoomLv.textContent = `${Math.round(targetScale * 100)}%`;
        const zoomLvMobile = document.getElementById('zoomLvMobile');
        if (zoomLvMobile) {
          zoomLvMobile.textContent = `${Math.round(targetScale * 100)}%`;
        }
        
        // Update state for next move event
        lastTouchDistance = currentDistance;
        lastTouchCenter = currentCenter;
        
        // Apply changes immediately for smooth pinch feedback
        scale = targetScale;
        offX = targetOffX;
        offY = targetOffY;
        draw();
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        // All touches ended - clean up all state
        lastTouch = null;
        lastTouchDistance = null;
        lastTouchCenter = null;
        isPinching = false;
        setTimeout(() => { isDragging = false; }, 100);
        updateURL();
      } else if (e.touches.length === 1 && isPinching) {
        // Went from two touches to one - switch back to pan mode
        isPinching = false;
        lastTouchDistance = null;
        lastTouchCenter = null;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isDragging = false;
      }
    }, { passive: true });

    // Mouse drag navigation
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return; // Only left mouse button
      mouseDragStart = { x: e.clientX, y: e.clientY };
      isDragging = false; // Reset, will be set to true if we actually drag
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', e => {
      if (!mouseDragStart) return;
      
      const deltaX = e.clientX - mouseDragStart.x;
      const deltaY = e.clientY - mouseDragStart.y;
      
      // Set dragging flag if we've moved more than a few pixels
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        isDragging = true;
      }
      
      if (isDragging) {
        targetOffX = offX + deltaX;
        targetOffY = offY + deltaY;
        mouseDragStart = { x: e.clientX, y: e.clientY };
        
        // Update current position for smooth dragging
        offX = targetOffX;
        offY = targetOffY;
        draw();
      }
    });

    canvas.addEventListener('mouseup', () => {
      mouseDragStart = null;
      canvas.style.cursor = 'grab';
      if (isDragging) {
        updateURL();
        setTimeout(() => { isDragging = false; }, 100);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      mouseDragStart = null;
      canvas.style.cursor = 'grab';
      if (isDragging) {
        updateURL();
        setTimeout(() => { isDragging = false; }, 100);
      }
    });

    canvas.addEventListener('dblclick', e => {
      const r = canvas.getBoundingClientRect(),
        wx = (e.clientX - r.left - offX) / scale,
        wy = (e.clientY - r.top - offY) / scale,
        col = Math.floor(wx / TILE), row = Math.floor(wy / TILE),
        x = col + minX, y = maxY - row;
      const hit = meta.find(i =>
        +i.attributes.find(t => t.trait_type === 'X.Coord').value === x &&
        +i.attributes.find(t => t.trait_type === 'Y.Coord').value === y
      );
      if (!hit) return;
      const imageSrc = `${SPRITE256_BASE}/${hit.tokenId}.png`;
      overlayImg.src = imageSrc;
      overlayImg.alt = `NFT Plot #${hit.tokenId}`;
      overlayImg.title = 'Click to expand full-screen';
      popupMeta.innerHTML = `
        <h3 style="margin-bottom: 16px; color: var(--accent); font-size: 18px;">Plot #${hit.tokenId}</h3>
        ${hit.attributes.map(a => `<p><strong>${a.trait_type}:</strong> <span>${a.value}</span></p>`).join('')}
      `;
      overlay.classList.add('show');
      overlay.style.display = 'flex';
      
      // Track plot popup opened with full metadata
      if (window.MixpanelTracker) {
        window.MixpanelTracker.trackPlotPopupOpened(hit.tokenId, hit);
      }
      
      // Add click handler for full-screen expansion
      const handleImageClick = () => {
        // Track plot popup image click
        if (window.MixpanelTracker) {
          window.MixpanelTracker.trackPlotPopupInteraction('image-clicked', hit.tokenId, { 
            wentFullscreen: true 
          });
        }
        showFullscreenImage(imageSrc);
      };
      overlayImg.addEventListener('click', handleImageClick);
      
      // Add escape key handler
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          closePopup();
        }
      };
      document.addEventListener('keydown', handleEscape);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePopup();
      });
      
      function closePopup() {
        overlay.style.display = 'none';
        overlay.classList.remove('show');
        document.removeEventListener('keydown', handleEscape);
        overlayImg.removeEventListener('click', handleImageClick);
      }
      
      backBtn.onclick = closePopup;
    });

    // Arrow key navigation
    document.addEventListener('keydown', e => {
      // Only handle arrow keys when no input element is focused
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
        return;
      }
      
      const PAN_DISTANCE = 50;
      let handled = false;
      
      switch(e.key) {
        case 'ArrowUp':
          targetOffY += PAN_DISTANCE;
          handled = true;
          break;
        case 'ArrowDown':
          targetOffY -= PAN_DISTANCE;
          handled = true;
          break;
        case 'ArrowLeft':
          targetOffX += PAN_DISTANCE;
          handled = true;
          break;
        case 'ArrowRight':
          targetOffX -= PAN_DISTANCE;
          handled = true;
          break;
      }
      
      if (handled) {
        e.preventDefault();
        updateURL();
        animate();
      }
    });

    // backBtn handler is set in double-click event
  }

  // ─── ETHERSCAN WALLET LOOKUP ───────────────

  // 1) Your Etherscan key & base URL
  const ETHERSCAN_API_KEY = 'INJ5XFVW88UPF6AUER8YV2KSI4EKKZXZ64';
  const ETHERSCAN_API_BASE = 'https://api.etherscan.io/v2/api';

  // 2) Turf contract
  const TURF_ADDRESS = '0x55d89273143DE3dE00822c9271DbCBD9B44B44C6';

  // 3) Fetch & reconstruct holdings via the v2 tokencall
  async function highlightWallet(addr) {
    const startTime = performance.now();
    
    const qs = new URLSearchParams({
      chainid: '1',             // v2 requires explicit chain id
      module: 'account',
      action: 'tokennfttx',    // ERC-721 transfers
      address: addr,
      contractaddress: TURF_ADDRESS,    // filter to Turf contract
      startblock: '0',
      endblock: '99999999',
      sort: 'asc',
      apikey: ETHERSCAN_API_KEY
    });

    const res = await fetch(`${ETHERSCAN_API_BASE}?${qs}`);
    const json = await res.json();
    if (json.status !== '1') {
      // no transfers found → clear selection
      if (json.message === 'No transactions found') {
        selected.clear();
        draw();
        return;
      }
      throw new Error(`Etherscan v2 error: ${json.message}`);
    }

    // rebuild current holdings
    const txs = json.result;
    const holdings = new Set();
    const lcAddr = addr.toLowerCase();

    txs.forEach(tx => {
      const id = Number(tx.tokenID);
      const from = tx.from.toLowerCase();
      const to = tx.to.toLowerCase();
      if (from === lcAddr) holdings.delete(id);
      if (to === lcAddr) holdings.add(id);
    });

    // update wallet holdings & redraw
    walletHoldings.set(addr, holdings);
    updateActiveWallets();
    draw();
    
    // Track successful wallet lookup
    if (window.MixpanelTracker) {
      const lookupTime = performance.now() - startTime;
      window.MixpanelTracker.trackWalletLookup(addr, holdings.size, Math.round(lookupTime), true);
    }
  }

  // 4) Hook up wallet input functionality
  async function processWalletAddress() {
    const addr = document.getElementById('walletInput').value.trim();
    if (!addr) return;
    
    if (!ethers.isAddress(addr)) {
      // Track invalid address error
      if (window.MixpanelTracker) {
        window.MixpanelTracker.trackWalletError(addr, 'invalid-address', 'Address validation failed');
      }
      return alert('Invalid ETH address');
    }
    try {  
      await highlightWallet(addr);
      document.getElementById('walletInput').value = ''; // Clear input after success
    } catch (e) {
      console.error(e);
      // Track wallet lookup network error
      if (window.MixpanelTracker) {
        window.MixpanelTracker.trackWalletError(addr, 'network-error', e.message);
      }
      alert('Failed to fetch holdings from Etherscan v2');
    }
  }

  document.getElementById('walletBtn').onclick = processWalletAddress;
  
  // Add Enter key support to wallet input
  document.getElementById('walletInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processWalletAddress();
    }
  });

  // ─── SMOOTH ANIMATION ───────────────────────────────────────────────────
  function animate() {
    scale += (targetScale - scale) * 0.2;
    offX += (targetOffX - offX) * 0.2;
    offY += (targetOffY - offY) * 0.2;
    draw();
    if (
      Math.abs(targetScale - scale) > 0.001 ||
      Math.abs(targetOffX - offX) > 0.5 ||
      Math.abs(targetOffY - offY) > 0.5
    ) requestAnimationFrame(animate);
  }

  // ─── FAQ MODAL MANAGEMENT ─────────────────────────────────────────────
  const faqLink = document.getElementById('faqLink'),
        faqOverlay = document.getElementById('faqOverlay'),
        faqCloseBtn = document.getElementById('faqCloseBtn');

  // Show FAQ modal
  faqLink?.addEventListener('click', (e) => {
    e.preventDefault();
    faqOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  });

  // Close FAQ modal
  function closeFAQ() {
    faqOverlay.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  faqCloseBtn?.addEventListener('click', closeFAQ);

  // Close FAQ on overlay click
  faqOverlay?.addEventListener('click', (e) => {
    if (e.target === faqOverlay) {
      closeFAQ();
    }
  });

  // Close FAQ on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && faqOverlay.style.display === 'flex') {
      closeFAQ();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MIXPANEL INTEGRATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Expose helper functions for Mixpanel tracking
  window.turfApp = {
    getCurrentZoomLevel: () => `${Math.round(targetScale * 100)}%`,
    getActiveFiltersCount: () => Object.keys(filters).length,
    getTotalPlotsCount: () => meta ? meta.length : 0,
    getSelectedPlots: () => Array.from(selected),
    getMatchedPlotsCount: () => matched.size,
    hasActiveSearch: () => {
      return Object.keys(filters).some(key => key.startsWith('__'));
    },
    getVisiblePlotsCount: () => {
      // Simple approximation based on viewport and zoom
      const viewportTiles = Math.ceil(canvas.width / (TILE * scale)) * Math.ceil(canvas.height / (TILE * scale));
      return Math.min(viewportTiles, meta ? meta.length : 0);
    }
  };

})();
