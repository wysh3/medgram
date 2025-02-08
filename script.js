const container = document.getElementById('container');
        const favoritesPanel = document.getElementById('favoritesPanel');
        const favoritesList = document.getElementById('favoritesList');
        const favoritesToggle = document.getElementById('favoritesToggle');
        
        let currentIndex = 0;
        let papers = [];
        let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        let startIndex = 0;  
        let isLoading = false;  

        favoritesToggle.addEventListener('click', () => {
            favoritesPanel.classList.toggle('show');
        });

        function updateFavoritesList() {
            favoritesList.innerHTML = '';
            favorites.forEach((paper) => {
                const item = document.createElement('div');
                item.className = 'favorite-item';
                item.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${paper.title}</div>
                    <div style="font-size: 0.8rem; color: var(--secondary-text);">${paper.authors}</div>
                `;
                item.addEventListener('click', () => {
                    window.open(paper.link, '_blank');
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
            
            try {
                const query = 'cat:q-bio+OR+cat:med+OR+cat:q-bio.BM+OR+cat:q-bio.GN+OR+cat:q-bio.MN+OR+cat:q-bio.NC+OR+cat:q-bio.OT+OR+cat:q-bio.PE+OR+cat:q-bio.QM+OR+cat:q-bio.SC+OR+cat:q-bio.TO';
                const response = await fetch(
                    `https://export.arxiv.org/api/query?search_query=${query}&start=${start}&max_results=10&sortBy=submittedDate&sortOrder=descending`
                );
                const text = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'text/xml');
                const entries = xmlDoc.getElementsByTagName('entry');

                const newPapers = Array.from(entries).map(entry => ({
                    title: entry.getElementsByTagName('title')[0].textContent,
                    authors: Array.from(entry.getElementsByTagName('author'))
                        .map(author => author.getElementsByTagName('name')[0].textContent)
                        .join(', '),
                    abstract: entry.getElementsByTagName('summary')[0].textContent,
                    published: new Date(entry.getElementsByTagName('published')[0].textContent)
                        .toLocaleDateString(),
                    link: entry.getElementsByTagName('id')[0].textContent
                }));

                papers = [...papers, ...newPapers];
                startIndex += newPapers.length;
                
                renderPapers();
                updateFavoritesList();
            } catch (error) {
                console.error('Error fetching papers:', error);
            } finally {
                isLoading = false;
            }
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
                        <div class="share-container">
                            <button class="share-btn twitter-share" title="Share on Twitter">
                                <i class="fab fa-twitter"></i>
                            </button>
                            <button class="share-btn linkedin-share" title="Share on LinkedIn">
                                <i class="fab fa-linkedin-in"></i>
                            </button>
                            <button class="share-btn copy-link" title="Copy Link">
                                <i class="fas fa-link"></i>
                            </button>
                        </div>
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
                    </div>
                `;

                const twitterBtn = paperCard.querySelector('.twitter-share');
                const linkedinBtn = paperCard.querySelector('.linkedin-share');
                const copyBtn = paperCard.querySelector('.copy-link');
                const likeButton = paperCard.querySelector('.like-button');

                twitterBtn.addEventListener('click', () => sharePaper('twitter', paper));
                linkedinBtn.addEventListener('click', () => sharePaper('linkedin', paper));
                copyBtn.addEventListener('click', () => sharePaper('copy', paper));
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
            const threshold = 50; // minimum distance for swipe

            if (Math.abs(swipeDistance) > threshold) {
                if (swipeDistance > 0) {
                    scrollToIndex(currentIndex + 1);
                } else {
                    scrollToIndex(currentIndex - 1);
                }
            }
        }

        fetchPapers();

