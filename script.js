document.addEventListener('DOMContentLoaded', () => {
    const ASSET_ROOT = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";
    const DATA_URL = `${ASSET_ROOT}/v1/summoner-icons.json`;
    
    const grid = document.getElementById('icon-grid');
    const loading = document.getElementById('loading');
    const searchInput = document.getElementById('searchInput');
    const sentinel = document.getElementById('sentinel');
    const modal = document.getElementById('modal');
    const modalOverlay = document.querySelector('.modal-overlay');
    const closeModalBtn = document.querySelector('.close-btn');

    let allIcons = [];
    let displayedIcons = [];
    let loadedCount = 0;
    const BATCH_SIZE = 50;
    let observer;

    async function fetchIcons() {
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            
            allIcons = data.sort((a, b) => b.id - a.id);
            displayedIcons = allIcons;
            
            loading.style.display = 'none';
            initIntersectionObserver();
            renderBatch();
        } catch (error) {
            console.error('Error loading icons:', error);
            loading.innerHTML = '<p style="color: #ff6b6b;">Error loading data.<br>Please reload the page.</p>';
        }
    }

    function getImageUrl(iconPath) {
        if (!iconPath) return '';
        const relativePath = iconPath.replace('/lol-game-data/assets', '');
        return `${ASSET_ROOT}${relativePath}`;
    }

    function renderBatch() {
        const batch = displayedIcons.slice(loadedCount, loadedCount + BATCH_SIZE);
        if (batch.length === 0) return;

        const fragment = document.createDocumentFragment();

        batch.forEach(icon => {
            const card = document.createElement('div');
            card.className = 'icon-card';
            card.onclick = () => openModal(icon);

            const imageUrl = getImageUrl(icon.imagePath);
            
            card.innerHTML = `
                <div class="img-container">
                    <img src="${imageUrl}" alt="${icon.title || 'Icon'}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg'">
                </div>
                <div class="card-info">
                    <div class="card-title" title="${icon.title}">${icon.title || 'No Title'}</div>
                    <div class="card-year">${icon.yearReleased || 'Unknown'}</div>
                </div>
            `;
            fragment.appendChild(card);
        });

        grid.appendChild(fragment);
        loadedCount += batch.length;
    }

    function initIntersectionObserver() {
        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                renderBatch();
            }
        }, { rootMargin: '200px' });
        
        observer.observe(sentinel);
    }

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        grid.innerHTML = '';
        loadedCount = 0;
        window.scrollTo(0, 0);

        if (term === '') {
            displayedIcons = allIcons;
        } else {
            displayedIcons = allIcons.filter(icon => {
                const title = (icon.title || '').toLowerCase();
                const id = icon.id.toString();
                const desc = (icon.descriptions ? icon.descriptions[0]?.description || '' : '').toLowerCase();
                
                return title.includes(term) || id.includes(term) || desc.includes(term);
            });
        }
        
        renderBatch();
    });

    function openModal(icon) {
        const imageUrl = getImageUrl(icon.imagePath);
        document.getElementById('modal-img').src = imageUrl;
        document.getElementById('modal-title').textContent = icon.title || 'Untitled Icon';
        document.getElementById('modal-year').textContent = `Released: ${icon.yearReleased || 'N/A'}`;
        document.getElementById('modal-id').textContent = `ID: ${icon.id}`;
        
        const descText = icon.descriptions && icon.descriptions.length > 0 
            ? icon.descriptions[0].description 
            : 'No description available for this icon.';
        document.getElementById('modal-desc').innerHTML = descText; 

        const legacyBadge = document.getElementById('modal-legacy');
        if (icon.isLegacy) {
            legacyBadge.classList.add('is-legacy');
        } else {
            legacyBadge.classList.remove('is-legacy');
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });

    fetchIcons();
});
