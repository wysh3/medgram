const container = document.getElementById('container');
const favoritesPanel = document.getElementById('favoritesPanel');
const favoritesList = document.getElementById('favoritesList');
const favoriteToggleMobile = document.getElementById('favorite-toggle');
const favoriteToggleDesktop = document.getElementById('favorite-toggle-desktop');
const homeBtnMobile = document.getElementById('home-btn');
const homeBtnDesktop = document.getElementById('home-btn-desktop');
const shareBtnMobile = document.getElementById('share-btn');
const shareBtnDesktop = document.getElementById('share-btn-desktop');
const sharePopup = document.getElementById('sharePopup');

let currentIndex = 0;
let papers = [];
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let startIndex = 0;  
let isLoading = false;  

favoriteToggleMobile.addEventListener('click', () => {
    favoritesPanel.classList.toggle('show');
});

favoriteToggleDesktop.addEventListener('click', () => {
    favoritesPanel.classList.toggle('show');
});

homeBtnMobile.addEventListener('click', () => {
    container.scrollTo({ top: 0, behavior: 'smooth' });
});

homeBtnDesktop.addEventListener('click', () => {
    container.scrollTo({ top: 0, behavior: 'smooth' });
});

shareBtnMobile.addEventListener('click', () => {
    sharePopup.classList.toggle('show');
});

shareBtnDesktop.addEventListener('click', () => {
    sharePopup.classList.toggle('show');
});

const twitterShare = sharePopup.querySelector('.twitter-share');
const linkedinShare = sharePopup.querySelector('.linkedin-share');
const copyLink = sharePopup.querySelector('.copy-link');

twitterShare.addEventListener('click', () => {
    const currentPaper = papers[currentIndex];
    sharePaper('twitter', currentPaper);
    sharePopup.classList.remove('show');
});

linkedinShare.addEventListener('click', () => {
    const currentPaper = papers[currentIndex];
    sharePaper('linkedin', currentPaper);
    sharePopup.classList.remove('show');
});

copyLink.addEventListener('click', () => {
    const currentPaper = papers[currentIndex];
    sharePaper('copy', currentPaper);
    sharePopup.classList.remove('show');
});

function updateFavoritesList() {
    favoritesList.innerHTML = '';
    favorites.forEach((paper) => {
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
            <div class="favorite-item-content">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${paper.title}</div>
                <div style="font-size: 0.8rem; color: var(--secondary-text);">${paper.authors}</div>
            </div>
            <button class="remove-favorite" title="Remove from favorites">×</button>
        `;
        const content = item.querySelector('.favorite-item-content');
        content.addEventListener('click', () => {
            window.open(paper.link, '_blank');
        });

        const removeBtn = item.querySelector('.remove-favorite');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = favorites.findIndex(f => f.title === paper.title);
            if (index !== -1) {
                favorites.splice(index, 1);
                localStorage.setItem('favorites', JSON.stringify(favorites));
                updateFavoritesList();
                renderPapers();
            }
        });
        favoritesList.appendChild(item);
    });
}

function toggleFavorite(paper, button) {
    const index = favorites.findIndex(f => f.title === paper.title);
    
    if (index === -1) {
        favorites.push(paper);
        button.classList.add('liked');
        button.textContent = '❤️';
    } else {
        favorites.splice(index, 1);
        button.classList.remove('liked');
        button.textContent = '🤍';
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavoritesList();
}

async function fetchPapers(start = 0) {
    if (isLoading) return;
    isLoading = true;
    
    const currentScrollPosition = container.scrollTop;
    
    try {
        const query = 'cat:q-bio+OR+cat:med+OR+cat:q-bio.BM+OR+cat:q-bio.GN+OR+cat:q-bio.MN+OR+cat:q-bio.NC+OR+cat:q-bio.OT+OR+cat:q-bio.PE+OR+cat:q-bio.QM+OR+cat:q-bio.SC+OR+cat:q-bio.TO';
        const response = await fetch(
            `https://export.arxiv.org/api/query?search_query=${query}&start=${start}&max_results=10&sortBy=submittedDate&sortOrder=descending`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML parsing failed');
        }
        
        const entries = xmlDoc.getElementsByTagName('entry');
        if (entries.length === 0) {
            showToast('No more papers available');
            return;
        }
        
        const newPapers = Array.from(entries).map(entry => ({
            title: entry.getElementsByTagName('title')[0]?.textContent || 'Untitled',
            authors: Array.from(entry.getElementsByTagName('author'))
                .map(author => author.getElementsByTagName('name')[0]?.textContent || 'Unknown')
                .join(', '),
            abstract: entry.getElementsByTagName('summary')[0]?.textContent || 'No abstract available',
            published: new Date(entry.getElementsByTagName('published')[0]?.textContent || Date.now())
                .toLocaleDateString(),
            link: entry.getElementsByTagName('id')[0]?.textContent || '#'
        }));
        
        papers = [...papers, ...newPapers];
        startIndex += newPapers.length;
        
        renderPapers();
        updateFavoritesList();
        
        setTimeout(() => {
            try {
                const container = document.getElementById('container');
                if (currentIndex === 0 && container.scrollTop === 0) {
                    papers = [];
                    startIndex = 0;
                    fetchPapers();
                }
            } catch (error) {
                console.error('Auto-refresh error:', error);
                showToast('Failed to refresh papers');
            }
        }, 300000);
        
    } catch (error) {
        console.error('Error fetching papers:', error);
        showToast('Failed to load papers. Please try again later.');
    } finally {
        isLoading = false;
        container.scrollTop = currentScrollPosition;
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function renderLatex(element) {
    renderMathInElement(element, {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
        output: 'html'
    });
}

function highlightKeywords(text) {
    const keywords = [
        'clinical trial', 'patient outcomes', 'biomarkers', 'epidemiology',
        'randomized controlled trial', 'cohort study', 'treatment efficacy',
        'public health', 'mortality rate', 'risk factors'
    ];
    
    let highlightedText = text;
    keywords.forEach(keyword => {
        const regex = new RegExp(`(${keyword})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
    });
    return highlightedText;
}

function boldHighlightText(text) {
    const importantPhrases = [
        'outperforms', 'state-of-the-art', 'novel', 'breakthrough',
        'significant improvement', 'better than', 'achieves',
        'first time', 'innovative', 'superior', 'advancement',
        'key findings', 'main contributions', 'results show'
    ];
    
    let highlightedText = text;
    importantPhrases.forEach(phrase => {
        const regex = new RegExp(`(${phrase})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<span class="bold-highlight">$1</span>');
    });
    return highlightedText;
}

function generateDiagram(paper) {
    const abstract = paper.abstract.toLowerCase();
    let diagramType = null;

    if (abstract.includes('clinical trial') || abstract.includes('randomized')) {
        diagramType = 'clinical_trial';
    } else if (abstract.includes('pathway') || abstract.includes('biological')) {
        diagramType = 'pathway';
    } else if (abstract.includes('imaging') || abstract.includes('radiological')) {
        diagramType = 'medical_imaging';
    }

    return diagramType ? getDiagramSVG(diagramType) : '';
}

function getDiagramSVG(type) {
    const diagrams = {
        clinical_trial: `
            <div class="diagram-container">
                <svg viewBox="0 0 200 100">
                    <rect x="20" y="20" width="160" height="60" rx="5" fill="none" stroke="#64ffda"/>
                    <path d="M100,20 v60 M20,50 h160" stroke="#64ffda"/>
                    <text x="50" y="40" fill="#64ffda" font-size="8">Control Group</text>
                    <text x="130" y="40" fill="#64ffda" font-size="8">Treatment Group</text>
                    <path d="M20,80 Q100,90 180,80" stroke="#64ffda" fill="none"/>
                    <text x="100" y="90" fill="#64ffda" font-size="8" text-anchor="middle">Outcome Measurement</text>
                </svg>
                <div class="media-caption">Clinical Trial Design</div>
            </div>
        `,
        pathway: `
            <div class="diagram-container">
                <svg viewBox="0 0 200 100">
                    <circle cx="50" cy="50" r="15" fill="none" stroke="#64ffda"/>
                    <circle cx="150" cy="50" r="15" fill="none" stroke="#64ffda"/>
                    <path d="M65,50 Q100,30 135,50" stroke="#64ffda" fill="none" marker-end="url(#arrow)"/>
                    <path d="M65,50 Q100,70 135,50" stroke="#64ffda" fill="none" marker-end="url(#arrow)"/>
                    <text x="100" y="30" fill="#64ffda" font-size="8" text-anchor="middle">Activation</text>
                    <text x="100" y="70" fill="#64ffda" font-size="8" text-anchor="middle">Inhibition</text>
                    <text x="50" y="30" fill="#64ffda" font-size="8" text-anchor="middle">Receptor</text>
                    <text x="150" y="30" fill="#64ffda" font-size="8" text-anchor="middle">Response</text>
                </svg>
                <div class="media-caption">Biological Pathway</div>
            </div>
        `,
        medical_imaging: `
            <div class="diagram-container">
                <svg viewBox="0 0 200 100">
                    <rect x="30" y="20" width="140" height="60" fill="none" stroke="#64ffda"/>
                    <path d="M50,30 L150,70 M50,70 L150,30" stroke="#64ffda"/>
                    <circle cx="100" cy="50" r="25" fill="none" stroke="#64ffda"/>
                    <text x="100" y="85" fill="#64ffda" font-size="8" text-anchor="middle">Cross-Section View</text>
                </svg>
                <div class="media-caption">Medical Imaging Analysis</div>
            </div>
        `
    };
    return diagrams[type] || '';
}

function sharePaper(platform, paper) {
    const title = paper.title;
    const url = paper.link;

    switch (platform) {
        case 'twitter':
            window.open(
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
                '_blank'
            );
            break;
        case 'linkedin':
            window.open(
                `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
                '_blank'
            );
            break;
        case 'copy':
            navigator.clipboard.writeText(`${title}\n${url}`);
            showToast('Link copied to clipboard!');
            break;
    }
}

function renderPapers() {
    container.innerHTML = '';
    papers.forEach((paper, index) => {
        const paperCard = document.createElement('div');
        paperCard.className = 'paper-card';
        if (index === currentIndex) paperCard.classList.add('active');

        const isLiked = favorites.some(f => f.title === paper.title);
        const keyResults = extractKeyResults(paper.abstract);
        
        paperCard.innerHTML = `
            <div class="paper-content">
                <div class="paper-header">
                    <h2 class="title">${paper.title}</h2>
                    <div class="authors">${paper.authors.split(', ').length > 4 ? paper.authors.split(', ').slice(0, 4).join(', ') + ', et al.' : paper.authors}</div>
                </div>
                <div class="key-results">
                    ${keyResults.map(result => `
                        <div class="result-item">
                            <span class="result-icon">🔍</span>
                            <span>${result}</span>
                        </div>
                    `).join('')}
                </div>
                <p class="abstract">${paper.abstract.length > 400 ? paper.abstract.substring(0, 400) + '...' : paper.abstract}</p>
                <div class="metadata">
                    <span>${paper.published}</span>
                    <button class="like-button ${isLiked ? 'liked' : ''}">${isLiked ? '❤️' : '🤍'}</button>
                    <a href="${paper.link}" target="_blank" class="read-more">Read More</a>
                </div>
                <div class="heart-animation"></div>
            </div>
        `;

        const likeButton = paperCard.querySelector('.like-button');
        const paperContent = paperCard.querySelector('.paper-content');

        let lastTap = 0;
        let touchTimeout;

        paperContent.addEventListener('touchstart', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            clearTimeout(touchTimeout);
            
            if (tapLength < 300 && tapLength > 0) {
                const touch = e.touches[0];
                const rect = paperCard.getBoundingClientRect();
                const heartAnimation = paperCard.querySelector('.heart-animation');
                
                heartAnimation.style.left = `${touch.clientX - rect.left}px`;
                heartAnimation.style.top = `${touch.clientY - rect.top}px`;
                
                heartAnimation.classList.add('active');
                setTimeout(() => heartAnimation.classList.remove('active'), 800);
                
                toggleFavorite(paper, likeButton);
                e.preventDefault();
            }
            
            lastTap = currentTime;
        });

        likeButton.addEventListener('click', () => toggleFavorite(paper, likeButton));

        container.appendChild(paperCard);
        renderLatex(paperCard);
    });
}

function extractKeyResults(abstract) {
    const results = [];
    const sentences = abstract.split(/[.!?]+/);
    
    const keyPhrases = [
        'propose', 'present', 'introduce',
        'achieve', 'show', 'demonstrate',
        'improve', 'outperform', 'better',
        'novel', 'new', 'first'
    ];
    
    sentences.forEach(sentence => {
        if (results.length < 3 && 
            keyPhrases.some(phrase => sentence.toLowerCase().includes(phrase))) {
            results.push(sentence.trim());
        }
    });
    if (results.length === 0) {
        results.push(sentences[0].trim());
    }

    return results;
}

function createCatchyTitle(originalTitle) {
    return originalTitle
        .replace(/A Retrospective Study of|Clinical Trial of|Epidemiological Analysis of/gi, '')
        .replace(/Methodology|Protocol|Assessment/gi, '')
        .trim();
}

function generatePaperMedia(paper) {
    if (paper.abstract.includes('neural network') || paper.abstract.includes('deep learning')) {
        return `
            <div class="paper-media">
                <img src="https://via.placeholder.com/600x300/1a1b2e/64ffda?text=Neural+Network+Architecture" alt="Paper visualization">
                <div class="media-caption">Model Architecture Visualization</div>
            </div>
        `;
    }
    return ''; 
}

function handleScroll() {
    const cards = document.querySelectorAll('.paper-card');
    cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        if (Math.abs(rect.top - 60) < window.innerHeight / 2) {
            card.classList.add('active');
            currentIndex = index;
        } else {
            card.classList.remove('active');
        }
    });

    const lastCard = cards[cards.length - 1];
    if (lastCard) {
        const rect = lastCard.getBoundingClientRect();
        if (rect.bottom <= window.innerHeight * 1.5) {
            fetchPapers(startIndex);
        }
    }
}

function scrollToIndex(index) {
    const cards = document.querySelectorAll('.paper-card');
    if (index >= 0 && index < cards.length) {
        cards[index].scrollIntoView({ behavior: 'smooth' });
    }
}

container.addEventListener('scroll', handleScroll);

let touchStartY = 0;
let touchEndY = 0;

container.addEventListener('touchstart', e => {
    touchStartY = e.changedTouches[0].screenY;
});

container.addEventListener('touchend', e => {
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
});

function handleSwipe() {
    const swipeDistance = touchStartY - touchEndY;
    const threshold = 50;

    if (Math.abs(swipeDistance) > threshold) {
        if (swipeDistance > 0) {
            scrollToIndex(currentIndex + 1);
        } else {
            scrollToIndex(currentIndex - 1);
        }
    }
}

fetchPapers();

document.addEventListener('DOMContentLoaded', () => {
    let currentIndex = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    const container = document.getElementById('container');
    const cards = document.getElementsByClassName('paper-card');

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
            e.preventDefault();
            navigateCards('up');
        } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
            e.preventDefault();
            navigateCards('down');
        }
    });

    container.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaY) > 50) {
            if (deltaY > 0) {
                navigateCards('up');
            } else {
                navigateCards('down');
            }
        }
    }, { passive: true });

    let wheelTimeout;
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        if (wheelTimeout) return;
        
        wheelTimeout = setTimeout(() => {
            if (e.deltaY > 0) {
                navigateCards('down');
            } else {
                navigateCards('up');
            }
            wheelTimeout = null;
        }, 50);
    }, { passive: false });

    function navigateCards(direction) {
        if (direction === 'up' && currentIndex > 0) {
            currentIndex--;
        } else if (direction === 'down' && currentIndex < cards.length - 1) {
            currentIndex++;
        }

        cards[currentIndex].scrollIntoView({ behavior: 'smooth' });
        updateActiveCard();
    }

    function updateActiveCard() {
        Array.from(cards).forEach((card, index) => {
            if (index === currentIndex) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }

    updateActiveCard();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = Array.from(cards).indexOf(entry.target);
                currentIndex = index;
                updateActiveCard();
            }
        });
    }, {
        threshold: 0.5
    });

    Array.from(cards).forEach(card => observer.observe(card));
});