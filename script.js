(function() {
    // --- Constants ---
    const ARXIV_API_BASE = 'https://export.arxiv.org/api/query';
    const ARXIV_QUERY = 'cat:q-bio+OR+cat:med+OR+cat:q-bio.BM+OR+cat:q-bio.GN+OR+cat:q-bio.MN+OR+cat:q-bio.NC+OR+cat:q-bio.OT+OR+cat:q-bio.PE+OR+cat:q-bio.QM+OR+cat:q-bio.SC+OR+cat:q-bio.TO';
    const RESULTS_PER_PAGE = 10;
    const SCROLL_DEBOUNCE_MS = 100; // Kept for potential future use, but not for infinite scroll trigger
    const WHEEL_DEBOUNCE_MS = 50;
    const DOUBLE_TAP_THRESHOLD_MS = 300;
    const SWIPE_THRESHOLD_PX = 50;
    // Pre-fetch when user is roughly halfway through the current batch
    const PREFETCH_THRESHOLD = Math.floor(RESULTS_PER_PAGE / 2);
    // Image URLs
    const HEART_UNLIKED_URL = 'https://em-content.zobj.net/source/microsoft-3D-fluent/406/white-heart_1f90d.png';
    const HEART_LIKED_URL = 'https://em-content.zobj.net/source/microsoft-3D-fluent/406/red-heart_2764-fe0f.png';
    const HEART_ANIMATION_URL = 'https://em-content.zobj.net/source/microsoft-teams/363/red-heart_2764-fe0f.png';


    // --- State Variables ---
    let currentIndex = 0;
    let papers = [];
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    let startIndex = 0; // Tracks the start index for the NEXT fetch
    let isLoading = false;
    // Removed scrollTimeout, wheelTimeout
    let lastTap = 0;
    // Removed touchStartY
    let intersectionObserver;

    // --- DOM Element References ---
    const container = document.getElementById('container');
    const favoritesPanel = document.getElementById('favoritesPanel');
    const favoritesList = document.getElementById('favoritesList');
    const sharePopup = document.getElementById('sharePopup');
    const homeBtn = document.getElementById('home-btn');
    const favoriteToggleBtn = document.getElementById('favorite-toggle');
    const shareBtn = document.getElementById('share-btn');
    const twitterShareBtn = sharePopup.querySelector('.twitter-share');
    const linkedinShareBtn = sharePopup.querySelector('.linkedin-share');
    const copyLinkBtn = sharePopup.querySelector('.copy-link');
    // Added overlay elements
    const overlayLogo = document.getElementById('overlayLogo');
    const overlayHint = document.getElementById('overlayHint');


    // --- Helper Functions ---

    /** Debounce function */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /** Shows a short-lived toast message */
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => { // Ensure element is in DOM before animating
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, 2000);
    }

    /** Renders LaTeX math expressions in an element */
    function renderLatex(element) {
        if (window.renderMathInElement) {
            try {
                window.renderMathInElement(element, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false,
                    output: 'html'
                });
            } catch (error) {
                console.error("KaTeX rendering failed:", error);
            }
        } else {
            console.warn("KaTeX script not loaded or renderMathInElement not found.");
        }
    }

    /** Extracts up to 3 key sentences from abstract */
    function extractKeyResults(abstract) {
        const results = [];
        const sentences = abstract.split(/[.!?]+/);
        const keyPhrases = [
            'propose', 'present', 'introduce', 'achieve', 'show', 'demonstrate',
            'improve', 'outperform', 'better', 'novel', 'new', 'first',
            'key finding', 'conclusion', 'result' // Added more relevant terms
        ];

        for (const sentence of sentences) {
            const trimmedSentence = sentence.trim();
            if (!trimmedSentence) continue;
            if (results.length < 3 && keyPhrases.some(phrase => trimmedSentence.toLowerCase().includes(phrase))) {
                results.push(trimmedSentence);
            }
            if (results.length >= 3) break;
        }
        // Fallback to first sentence if no key phrases found
        if (results.length === 0 && sentences[0]) {
            results.push(sentences[0].trim());
        }
        return results;
    }

    // --- Core Logic Functions ---

    /** Parses arXiv XML response */
    function parseArxivXML(xmlDoc) {
        const entries = xmlDoc.getElementsByTagName('entry');
        if (entries.length === 0) {
            showToast('No more papers available');
            return []; // Return empty array if no entries
        }

        return Array.from(entries).map(entry => ({
            title: entry.getElementsByTagName('title')[0]?.textContent.trim().replace(/\s+/g, ' ') || 'Untitled',
            authors: Array.from(entry.getElementsByTagName('author'))
                .map(author => author.getElementsByTagName('name')[0]?.textContent || 'Unknown')
                .join(', '),
            abstract: entry.getElementsByTagName('summary')[0]?.textContent.trim().replace(/\s+/g, ' ') || 'No abstract available',
            published: new Date(entry.getElementsByTagName('published')[0]?.textContent || Date.now()).toLocaleDateString(),
            // Use PDF link if available, otherwise fallback to abstract link
            link: entry.querySelector('link[title="pdf"]')?.getAttribute('href') || entry.getElementsByTagName('id')[0]?.textContent || '#'
        }));
    }

    /** Fetches papers from arXiv API */
    async function fetchPapers(start = 0) {
        if (isLoading) return;
        isLoading = true;
        console.log(`Fetching papers starting from index ${start}...`);

        try {
            const apiUrl = `${ARXIV_API_BASE}?search_query=${ARXIV_QUERY}&start=${start}&max_results=${RESULTS_PER_PAGE}&sortBy=submittedDate&sortOrder=descending`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');

            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                console.error("XML Parsing Error:", parserError.textContent);
                throw new Error('XML parsing failed');
            }

            const newPapers = parseArxivXML(xmlDoc);

            if (newPapers.length > 0) {
                papers = [...papers, ...newPapers];
                startIndex += newPapers.length; // Update startIndex for the *next* fetch
                appendPapers(newPapers); // Append only the new papers
                updateFavoritesList(); // Update favorites in case status changed
            } else {
                 // If no new papers are returned, we might have reached the end
                 console.log("No more papers found from API.");
            }
        } catch (error) {
            console.error('Error fetching papers:', error);
            showToast('Failed to load papers. Please try again later.');
        } finally {
            isLoading = false;
        }
    }

    /** Creates and returns a DOM element for a single paper */
    function renderSinglePaper(paper, index) {
        const paperCard = document.createElement('div');
        paperCard.className = 'paper-card';
        paperCard.dataset.index = index; // Store index for IntersectionObserver

        const isLiked = favorites.some(f => f.title === paper.title);
        const keyResults = extractKeyResults(paper.abstract);
        const displayAuthors = paper.authors.split(', ').length > 4
            ? paper.authors.split(', ').slice(0, 4).join(', ') + ', et al.'
            : paper.authors;
        const truncatedAbstract = paper.abstract.length > 400
            ? paper.abstract.substring(0, 400) + '...'
            : paper.abstract;

        const paperContent = document.createElement('div');
        paperContent.className = 'paper-content';
        // Updated like button to use img tag
        paperContent.innerHTML = `
            <div class="paper-header">
                <h2 class="title">${paper.title}</h2>
                <div class="authors">${displayAuthors}</div>
            </div>
            <div class="key-results">
                ${keyResults.map(result => `
                    <div class="result-item">
                        <span class="result-icon">🔍</span>
                        <span>${result}</span>
                    </div>
                `).join('')}
            </div>
            <p class="abstract">${truncatedAbstract}</p>
            <div class="metadata">
                <span>${paper.published}</span>
                <button class="like-button ${isLiked ? 'liked' : ''}" aria-label="Like or unlike paper">
                    <img src="${isLiked ? HEART_LIKED_URL : HEART_UNLIKED_URL}" alt="${isLiked ? 'Liked' : 'Not Liked'}">
                </button>
                <a href="${paper.link}" target="_blank" rel="noopener noreferrer" class="read-more">Read More</a>
            </div>
            <div class="heart-animation"></div>
        `;

        // --- Add Event Listeners to new elements ---
        const titleElement = paperContent.querySelector('.title');
        titleElement.addEventListener('click', () => window.open(paper.link, '_blank'));

        const likeButton = paperContent.querySelector('.like-button');
        likeButton.addEventListener('click', () => toggleFavorite(paper, likeButton));

        // Double-tap to like listener - Pass paperContent instead of paperCard
        paperContent.addEventListener('touchstart', (e) => handleDoubleTap(e, paper, likeButton, paperContent), { passive: false });

        paperCard.appendChild(paperContent);
        renderLatex(paperContent); // Render LaTeX for the new content

        // Observe the new card
        if (intersectionObserver) {
            intersectionObserver.observe(paperCard);
        }

        return paperCard;
    }

    /** Appends new paper cards to the container */
    function appendPapers(newPapers) {
        const fragment = document.createDocumentFragment();
        newPapers.forEach((paper, i) => {
            const globalIndex = papers.length - newPapers.length + i;
            const paperCard = renderSinglePaper(paper, globalIndex);
            fragment.appendChild(paperCard);
        });
        container.appendChild(fragment);

        // Ensure the first card is active if it's the initial load
        if (papers.length === newPapers.length && container.scrollTop === 0) {
            updateActiveCardClass(0);
            // Also ensure overlays are visible on initial load
            if (overlayLogo) overlayLogo.classList.remove('hidden');
            if (overlayHint) overlayHint.classList.remove('hidden');
        }
    }


    /** Updates the list of favorite papers in the panel */
    function updateFavoritesList() {
        const fragment = document.createDocumentFragment();
        favorites.forEach((paper) => {
            const item = document.createElement('div');
            item.className = 'favorite-item';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'favorite-item-content';
            contentDiv.innerHTML = `
                <div class="favorite-title">${paper.title}</div>
                <div class="favorite-authors">${paper.authors}</div>
            `;
            // Removed inline styles

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-favorite';
            removeBtn.title = 'Remove from favorites';
            removeBtn.innerHTML = '&times;'; // Use HTML entity

            contentDiv.addEventListener('click', () => {
                window.open(paper.link, '_blank');
            });

            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = favorites.findIndex(f => f.title === paper.title);
                if (index !== -1) {
                    favorites.splice(index, 1);
                    localStorage.setItem('favorites', JSON.stringify(favorites));
                    updateFavoritesList(); // Re-render favorites list
                    // Update like button status on currently visible cards
                    document.querySelectorAll('.paper-card').forEach(cardElement => {
                        const cardIndex = parseInt(cardElement.dataset.index, 10);
                        if (papers[cardIndex]?.title === paper.title) {
                            const likeBtn = cardElement.querySelector('.like-button');
                            if (likeBtn) {
                                likeBtn.classList.remove('liked');
                                // Update button to use unliked image
                                likeBtn.innerHTML = `<img src="${HEART_UNLIKED_URL}" alt="Not Liked">`;
                            }
                        }
                    });
                }
            });

            item.appendChild(contentDiv);
            item.appendChild(removeBtn);
            fragment.appendChild(item);
        });
        favoritesList.innerHTML = ''; // Clear existing list
        favoritesList.appendChild(fragment);
    }


    /** Toggles a paper's favorite status */
    function toggleFavorite(paper, button) {
        const index = favorites.findIndex(f => f.title === paper.title);
        let isLiked;

        if (index === -1) {
            favorites.push(paper);
            isLiked = true;
        } else {
            favorites.splice(index, 1);
            isLiked = false;
        }

        localStorage.setItem('favorites', JSON.stringify(favorites));
        updateFavoritesList();

        // Update button state visually using images
        if (button) {
            button.classList.toggle('liked', isLiked);
            button.innerHTML = `<img src="${isLiked ? HEART_LIKED_URL : HEART_UNLIKED_URL}" alt="${isLiked ? 'Liked' : 'Not Liked'}">`;
        }
    }

    /** Handles sharing the current paper */
    function sharePaper(platform) {
        if (currentIndex < 0 || currentIndex >= papers.length) return;
        const paper = papers[currentIndex];
        const title = paper.title;
        const url = paper.link;
        let shareUrl;

        switch (platform) {
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
                break;
            case 'copy':
                navigator.clipboard.writeText(`${title}\n${url}`)
                    .then(() => showToast('Link copied to clipboard!'))
                    .catch(err => {
                        console.error('Failed to copy link:', err);
                        showToast('Failed to copy link.');
                    });
                return; // Exit function for copy action
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
        }
        sharePopup.classList.remove('show'); // Close popup after action
    }

    // --- Navigation Functions ---

    // Removed scrollToIndex function (replaced by direct scrollIntoView/scrollTo calls)

    /** Updates the 'active' class on paper cards based on the current index */
    function updateActiveCardClass(newIndex) {
        container.querySelectorAll('.paper-card').forEach((card, idx) => {
            card.classList.toggle('active', idx === newIndex);
        });
    }

    // Removed handleNavigationIntent function (replaced by direct scrollIntoView calls in listeners)

    // --- Event Handlers ---

    /** Handles double-tap for liking - Changed paperCard to paperContent */
    function handleDoubleTap(e, paper, likeButton, paperContent) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;

        if (tapLength < DOUBLE_TAP_THRESHOLD_MS && tapLength > 0) {
            // Double tap detected
            e.preventDefault(); // Prevent zoom or other default actions

            const touch = e.touches[0];
            // Find heartAnimation within paperContent
            const heartAnimation = paperContent.querySelector('.heart-animation');
            if (heartAnimation && touch) {
                // Set animation image
                heartAnimation.innerHTML = `<img src="${HEART_ANIMATION_URL}" alt="Heart Animation">`;
                // Get bounding rect of paperContent
                const rect = paperContent.getBoundingClientRect();
                // Calculate position relative to paperContent
                heartAnimation.style.left = `${touch.clientX - rect.left}px`;
                heartAnimation.style.top = `${touch.clientY - rect.top}px`;
                heartAnimation.classList.add('active');
                // Remove animation class after animation completes
                heartAnimation.addEventListener('animationend', () => {
                    heartAnimation.classList.remove('active');
                    heartAnimation.innerHTML = ''; // Clear image after animation
                }, { once: true });
            }
            // Only add to favorites if not already liked
            if (!favorites.some(f => f.title === paper.title)) {
                 toggleFavorite(paper, likeButton);
            }


            lastTap = 0; // Reset lastTap to prevent triple tap issues
        } else {
            // Single tap
            lastTap = currentTime;
        }
    }

    // Removed debouncedScrollHandler
    // Removed debouncedWheelHandler


    /** Sets up all event listeners */
    function setupEventListeners() {
        // Navigation buttons
        homeBtn.addEventListener('click', () => container.scrollTo({ top: 0, behavior: 'smooth' }));
        favoriteToggleBtn.addEventListener('click', () => favoritesPanel.classList.toggle('show'));
        shareBtn.addEventListener('click', () => sharePopup.classList.toggle('show'));

        // Share options
        twitterShareBtn.addEventListener('click', () => sharePaper('twitter'));
        linkedinShareBtn.addEventListener('click', () => sharePaper('linkedin'));
        copyLinkBtn.addEventListener('click', () => sharePaper('copy'));

        // Close popups when clicking outside
        document.addEventListener('click', (e) => {
            if (!favoritesPanel.contains(e.target) && !favoriteToggleBtn.contains(e.target) && favoritesPanel.classList.contains('show')) {
                favoritesPanel.classList.remove('show');
            }
            if (!sharePopup.contains(e.target) && !shareBtn.contains(e.target) && sharePopup.classList.contains('show')) {
                sharePopup.classList.remove('show');
            }
        });

        // Keyboard navigation - Updated to use scrollIntoView directly
        document.addEventListener('keydown', (e) => {
            const cards = container.querySelectorAll('.paper-card');
            let targetIndex = -1;

            if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
                e.preventDefault();
                if (currentIndex > 0) {
                    targetIndex = currentIndex - 1;
                }
            } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (currentIndex < papers.length - 1) {
                    targetIndex = currentIndex + 1;
                }
            }

            if (targetIndex !== -1 && cards[targetIndex]) {
                cards[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
                // IntersectionObserver will update currentIndex and active class
            }
        });

        // Removed Touch navigation (Swipe) listeners - CSS Snap handles this

        // Removed Wheel navigation listener - CSS Snap handles this

        // Removed Scroll listener - IntersectionObserver handles necessary actions

        // Intersection Observer for active card AND pre-fetching AND overlay visibility
        intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = parseInt(entry.target.dataset.index, 10);
                    if (!isNaN(index) && index !== currentIndex) {
                         console.log(`Intersecting card index: ${index}`);
                         currentIndex = index;
                         updateActiveCardClass(currentIndex);

                         // --- Proactive Pre-fetch Logic ---
                         // Fetch next batch when user reaches PREFETCH_THRESHOLD cards away from the end of loaded content
                         if (!isLoading && currentIndex >= startIndex - PREFETCH_THRESHOLD) {
                             fetchPapers(startIndex);
                         }

                         // --- Overlay Visibility Logic ---
                         if (overlayLogo && overlayHint) {
                             if (currentIndex === 0) {
                                 overlayLogo.classList.remove('hidden');
                                 overlayHint.classList.remove('hidden');
                             } else {
                                 overlayLogo.classList.add('hidden');
                                 overlayHint.classList.add('hidden');
                             }
                         }
                    }
                }
            });
        }, {
            root: container, // Observe within the container
            threshold: 0.5 // Trigger when 50% of the card is visible
        });

        // Initial observation setup (will re-observe as cards are added)
        container.querySelectorAll('.paper-card').forEach(card => intersectionObserver.observe(card));
    }

    // --- Initialization ---
    function init() {
        // Set hint text based on touch support
        if (overlayHint) {
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            // Corrected arrow keys for desktop hint
            overlayHint.textContent = isTouchDevice ? 'Scroll to explore' : 'Scroll or use ↑↓ keys';
        }

        updateFavoritesList(); // Initial render of favorites
        fetchPapers(); // Initial fetch
        setupEventListeners(); // Setup all listeners

        // Initially hide overlays if not already on the first card (e.g., after refresh)
        // This check might be redundant if fetchPapers ensures first card is shown first,
        // but added for robustness.
        if (currentIndex !== 0) {
             if (overlayLogo) overlayLogo.classList.add('hidden');
             if (overlayHint) overlayHint.classList.add('hidden');
        }
    }

    // Run initialization when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init(); // DOM is already ready
    }

})(); // End of IIFE
