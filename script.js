document.addEventListener('DOMContentLoaded', () => {
    const ASSET_ROOT = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
    const DATA_URL = `${ASSET_ROOT}/v1/summoner-icons.json`;
    const SETS_URL = `${ASSET_ROOT}/v1/summoner-icon-sets.json`;

    const grid = document.getElementById('icon-grid');
    const loading = document.getElementById('loading');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const legacyToggle = document.getElementById('legacyToggle');
    const favoritesOnlyToggle = document.getElementById('favoritesOnlyToggle');
    const favoritesToggle = document.getElementById('favoritesToggle');
    const closeFavorites = document.getElementById('closeFavorites');
    const favoritesSection = document.getElementById('favoritesSection');
    const favoritesGrid = document.getElementById('favoritesGrid');
    const yearMinInput = document.getElementById('yearMin');
    const yearMaxInput = document.getElementById('yearMax');
    const clearFilters = document.getElementById('clearFilters');
    const eventFilters = document.getElementById('eventFilters');
    const rarityFilters = document.getElementById('rarityFilters');
    const favoriteButton = document.getElementById('favoriteButton');
    const copyLinkButton = document.getElementById('copyLinkButton');
    const noResults = document.getElementById('noResults');
    const modal = document.getElementById('modal');
    const modalOverlay = document.querySelector('.modal-overlay');
    const closeModalBtn = document.querySelector('.close-btn');

    const totalCountEl = document.getElementById('totalCount');
    const filteredCountEl = document.getElementById('filteredCount');
    const legacyCountEl = document.getElementById('legacyCount');
    const favoritesCountEl = document.getElementById('favoritesCount');

    let allIcons = [];
    let allSets = [];
    let iconToSets = {};
    let displayedIcons = [];
    let loadedCount = 0;
    let observer;
    const BATCH_SIZE = 48;
    let currentIcon = null;
    let favorites = [];
    const selectedEvents = new Set();
    const selectedRarities = new Set();
    let allEventTags = [];
    let selectedAlphabet = null;

    const RARITY_LABELS = {
        0: 'Standard',
        1: 'Rare',
        2: 'Epic',
        3: 'Legendary',
        4: 'Mythic',
        5: 'Ultimate',
        6: 'Exalted',
        7: 'Transcendent'
    };

    const sanitize = (value) => String(value ?? '').replace(/["<>]/g, '');

    const loadFavorites = () => {
        try {
            const saved = localStorage.getItem('lolIconFavorites');
            favorites = saved ? JSON.parse(saved) : [];
        } catch {
            favorites = [];
        }
    };

    const saveFavorites = () => {
        localStorage.setItem('lolIconFavorites', JSON.stringify(favorites));
        updateStats();
    };

    const getImageUrl = (iconPath) => {
        if (!iconPath) return '';
        const relativePath = iconPath.replace('/lol-game-data/assets', '');
        return `${ASSET_ROOT}${relativePath}`;
    };

    const getRarityValue = (icon) => {
        const record = icon.rarities?.find((item) => item.region === 'riot') || icon.rarities?.[0];
        return record?.rarity ?? 0;
    };

    const getRarityLabel = (rarity) => RARITY_LABELS[rarity] || `Tier ${rarity}`;

    const getEventTags = (iconId) => {
        const sets = iconToSets[iconId] || [];
        return sets.length > 0 ? sets : ['Other'];
    };

    const isFavorite = (iconId) => favorites.includes(iconId);

    const updateStats = () => {
        totalCountEl.textContent = allIcons.length;
        filteredCountEl.textContent = displayedIcons.length;
        legacyCountEl.textContent = allIcons.filter((icon) => icon.isLegacy).length;
        favoritesCountEl.textContent = favorites.length;
    };

    const updateYearControls = () => {
        const years = allIcons.map((icon) => Number(icon.yearReleased)).filter((year) => !Number.isNaN(year));
        if (!years.length) return;

        const min = Math.min(...years);
        const max = Math.max(...years);
        // Explicitly set the values to the actual min/max found in data
        // This ensures the filter range covers all available years, including 0 if present.
        yearMinInput.value = min;
        yearMaxInput.value = max;
    };

    const buildFilterChip = (label, value, selectedSet) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'filter-pill';
        chip.textContent = label;
        chip.dataset.value = value;
        if (selectedSet.has(value)) {
            chip.classList.add('active');
        }
        chip.addEventListener('click', () => {
            if (selectedSet.has(value)) {
                selectedSet.delete(value);
                chip.classList.remove('active');
            } else {
                selectedSet.add(value);
                chip.classList.add('active');
            }
            applyFilters();
        });
        return chip;
    };

    const renderFilterChips = (container, values, selectedSet, labelFormatter = (value) => value) => {
        container.innerHTML = '';
        values.forEach((value) => container.appendChild(buildFilterChip(labelFormatter(value), value, selectedSet)));
    };

    const createCard = (icon) => {
        const card = document.createElement('div');
        card.className = 'icon-card';
        card.addEventListener('click', () => openModal(icon));

        const imageUrl = getImageUrl(icon.imagePath);
        const legacyBadge = icon.isLegacy ? '<span class="badge-legacy">Legacy</span>' : '';
        const eventBadge = icon.eventTags?.[0] ? `<span class="badge">${sanitize(icon.eventTags[0])}</span>` : '';

        card.innerHTML = `
            <div class="img-container">
                <img src="${sanitize(imageUrl)}" alt="${sanitize(icon.title || 'Icon')}" loading="lazy" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg'">
                ${legacyBadge}${eventBadge}
            </div>
            <div class="card-info">
                <div class="card-title" title="${sanitize(icon.title || 'No Title')}">${sanitize(icon.title || 'No Title')}</div>
                <div class="card-meta">${icon.yearReleased || 'Unknown'} · ${getRarityLabel(icon.rarity)}</div>
            </div>
        `;

        return card;
    };

    const renderBatch = () => {
        if (!displayedIcons.length) {
            noResults.classList.remove('hidden');
            grid.innerHTML = '';
            return;
        }

        noResults.classList.add('hidden');
        const batch = displayedIcons.slice(loadedCount, loadedCount + BATCH_SIZE);
        if (!batch.length) return;

        const fragment = document.createDocumentFragment();
        batch.forEach((icon) => fragment.appendChild(createCard(icon)));
        grid.appendChild(fragment);
        loadedCount += batch.length;
    };

    const resetGrid = () => {
        grid.innerHTML = '';
        loadedCount = 0;
        if (observer) observer.disconnect();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        initIntersectionObserver();
    };

    const applyFilters = () => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        const legacyOnly = legacyToggle.checked;
        const favoritesOnly = favoritesOnlyToggle.checked;
        const minYear = Number(yearMinInput.value) || 0;
        const maxYear = Number(yearMaxInput.value) || Number.MAX_VALUE;
        const sortOrder = sortSelect.value;

        displayedIcons = allIcons
            .filter((icon) => {
                const title = (icon.title || '').toLowerCase();
                const id = icon.id.toString();
                const desc = (icon.descriptions?.[0]?.description || '').toLowerCase();
                const year = Number(icon.yearReleased) || 0;
                const matchesSearch = !searchTerm || title.includes(searchTerm) || id.includes(searchTerm) || desc.includes(searchTerm);
                const matchesLegacy = !legacyOnly || icon.isLegacy;
                const matchesFavorite = !favoritesOnly || favorites.includes(icon.id);
                const matchesYear = year >= minYear && year <= maxYear;
                const matchesEvent = !selectedEvents.size || icon.eventTags.some((tag) => selectedEvents.has(tag));
                const matchesRarity = !selectedRarities.size || selectedRarities.has(String(icon.rarity));

                return matchesSearch && matchesLegacy && matchesFavorite && matchesYear && matchesEvent && matchesRarity;
            })
            .sort((a, b) => {
                if (sortOrder === 'oldest') return a.id - b.id;
                if (sortOrder === 'alpha') return (a.title || '').localeCompare(b.title || '');
                if (sortOrder === 'rarity') return a.rarity - b.rarity || a.id - b.id;
                return b.id - a.id;
            });

        updateStats();
        updateAlphabetIndicators();
        resetGrid();
        renderBatch();
    };

    const initIntersectionObserver = () => {
        if (observer) observer.disconnect();
        observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) renderBatch();
        }, { rootMargin: '240px' });
        observer.observe(document.getElementById('sentinel'));
    };

    const openModal = (icon) => {
        currentIcon = icon;
        document.getElementById('modal-img').src = getImageUrl(icon.imagePath);
        document.getElementById('modal-title').textContent = icon.title || 'Untitled Icon';
        document.getElementById('modal-year').textContent = `Released: ${icon.yearReleased || 'N/A'}`;
        document.getElementById('modal-id').textContent = `ID: ${icon.id}`;
        document.getElementById('modal-desc').textContent = icon.descriptions?.[0]?.description || 'No description available for this icon.';
        document.getElementById('modal-legacy').classList.toggle('is-legacy', icon.isLegacy);
        favoriteButton.textContent = isFavorite(icon.id) ? 'Remove from favorites' : 'Save to favorites';
        favoriteButton.classList.toggle('button-secondary', isFavorite(icon.id));
        favoriteButton.classList.toggle('button-primary', !isFavorite(icon.id));
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    };

    const toggleFavorite = () => {
        if (!currentIcon) return;
        favorites = isFavorite(currentIcon.id)
            ? favorites.filter((id) => id !== currentIcon.id)
            : [currentIcon.id, ...favorites.filter((id) => id !== currentIcon.id)];
        saveFavorites();
        renderFavorites();
        openModal(currentIcon);
    };

    const copyLink = async () => {
        if (!currentIcon) return;
        const url = `${window.location.origin}${window.location.pathname}?icon=${currentIcon.id}`;
        await navigator.clipboard.writeText(url);
        copyLinkButton.textContent = 'Link copied!';
        setTimeout(() => { copyLinkButton.textContent = 'Copy link'; }, 1400);
    };

    const renderFavorites = () => {
        favoritesGrid.innerHTML = '';
        const savedIcons = allIcons.filter((icon) => favorites.includes(icon.id));
        if (!savedIcons.length) {
            favoritesGrid.innerHTML = '<p style="color: var(--text-muted);">No favorites yet. Open an icon and save it to build your list.</p>';
            return;
        }
        savedIcons.forEach((icon) => {
            const card = document.createElement('div');
            card.className = 'favorite-card';
            card.addEventListener('click', () => openModal(icon));
            card.innerHTML = `
                <img src="${sanitize(getImageUrl(icon.imagePath))}" alt="${sanitize(icon.title || 'Icon')}" loading="lazy" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg'">
                <div>
                    <h3>${sanitize(icon.title || 'No Title')}</h3>
                    <small>ID ${icon.id} · ${icon.yearReleased || 'Unknown'}</small>
                </div>
            `;
            favoritesGrid.appendChild(card);
        });
    };

    const toggleFavoritesSection = (show) => {
        favoritesSection.classList.toggle('hidden', !show);
    };

    const resetFilters = () => {
        searchInput.value = '';
        sortSelect.value = 'newest';
        legacyToggle.checked = false;
        favoritesOnlyToggle.checked = false;
        selectedEvents.clear();
        selectedRarities.clear();
        yearMinInput.value = yearMinInput.min;
        yearMaxInput.value = yearMaxInput.max;
        eventFilters.querySelectorAll('.filter-pill').forEach((pill) => pill.classList.remove('active'));
        rarityFilters.querySelectorAll('.filter-pill').forEach((pill) => pill.classList.remove('active'));
        document.querySelectorAll('.alphabet-btn').forEach((btn) => btn.classList.remove('has-selection'));
        applyFilters();
    };

    const initializeFilters = () => {
        const eventSet = new Set();
        const raritySet = new Set();
        allIcons.forEach((icon) => {
            icon.eventTags.forEach((tag) => eventSet.add(tag));
            raritySet.add(String(icon.rarity));
        });
        allEventTags = [...eventSet].sort();
        initializeAlphabet();
        renderFilterChips(rarityFilters, [...raritySet].sort((a, b) => Number(a) - Number(b)), selectedRarities, (value) => getRarityLabel(Number(value)));
        renderEventTagsByAlphabet('A');
    };

    const initializeAlphabet = () => {
        const alphabetContainer = document.getElementById('alphabetFilter');
        alphabetContainer.innerHTML = '';
        const letters = new Set();
        allEventTags.forEach((tag) => {
            const firstLetter = tag.charAt(0).toUpperCase();
            letters.add(firstLetter);
        });
        
        [...letters].sort().forEach((letter) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'alphabet-btn';
            btn.textContent = letter;
            btn.dataset.letter = letter;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.alphabet-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                selectedAlphabet = letter;
                renderEventTagsByAlphabet(letter);
            });
            if (letter === 'A') btn.classList.add('active');
            alphabetContainer.appendChild(btn);
        });
    };

    const renderEventTagsByAlphabet = (letter) => {
        const filtered = allEventTags.filter((tag) => tag.charAt(0).toUpperCase() === letter);
        renderFilterChips(eventFilters, filtered, selectedEvents, (value) => value);
        updateAlphabetIndicators();
    };

    const updateAlphabetIndicators = () => {
        document.querySelectorAll('.alphabet-btn').forEach((btn) => {
            const letter = btn.dataset.letter;
            const tagsForLetter = allEventTags.filter((tag) => tag.charAt(0).toUpperCase() === letter);
            const hasSelection = tagsForLetter.some((tag) => selectedEvents.has(tag));
            btn.classList.toggle('has-selection', hasSelection);
        });
    };

    const prepareIcons = (icons) => icons
        .sort((a, b) => b.id - a.id)
        .map((icon) => ({
            ...icon,
            rarity: getRarityValue(icon),
            eventTags: getEventTags(icon.id)
        }));

    const fetchIcons = async () => {
        try {
            const [iconsResponse, setsResponse] = await Promise.all([
                fetch(DATA_URL),
                fetch(SETS_URL)
            ]);
            if (!iconsResponse.ok || !setsResponse.ok) throw new Error('Network response was not ok');
            
            const iconsData = await iconsResponse.json();
            allSets = await setsResponse.json();
            
            // Build icon-to-sets mapping
            iconToSets = {};
            allSets.forEach((set) => {
                set.icons.forEach((iconId) => {
                    if (!iconToSets[iconId]) {
                        iconToSets[iconId] = [];
                    }
                    iconToSets[iconId].push(set.displayName);
                });
            });
            
            allIcons = prepareIcons(iconsData);
            loadFavorites();
            updateYearControls();
            initializeFilters();
            applyFilters();
            initIntersectionObserver();
            renderFavorites();
            updateStats();
            loading.classList.add('hidden');
            
            // Handle deep linking
            handleDeepLink();
        } catch (error) {
            console.error('Error loading icons:', error);
            loading.innerHTML = '<p style="color: #ff6b6b;">Error loading data. Please reload the page.</p>';
        }
    };

    const handleDeepLink = () => {
        const params = new URLSearchParams(window.location.search);
        const iconId = params.get('icon');
        if (iconId) {
            const icon = allIcons.find((i) => i.id === Number(iconId));
            if (icon) {
                setTimeout(() => openModal(icon), 100);
            }
        }
    };

    searchInput.addEventListener('input', () => applyFilters());
    sortSelect.addEventListener('change', () => applyFilters());
    legacyToggle.addEventListener('change', () => applyFilters());
    favoritesOnlyToggle.addEventListener('change', () => applyFilters());
    yearMinInput.addEventListener('change', () => applyFilters());
    yearMaxInput.addEventListener('change', () => applyFilters());
    clearFilters.addEventListener('click', resetFilters);
    favoritesToggle.addEventListener('click', () => toggleFavoritesSection(true));
    closeFavorites.addEventListener('click', () => toggleFavoritesSection(false));
    favoriteButton.addEventListener('click', toggleFavorite);
    copyLinkButton.addEventListener('click', copyLink);
    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });

    fetchIcons();
});
