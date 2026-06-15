// BigQuery Release Hub Front-end Controller

document.addEventListener('DOMContentLoaded', () => {
    // State Management
    let releases = [];
    let parsedUpdates = [];
    let selectedUpdate = null;
    let activeFilter = 'all';
    let searchQuery = '';

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const syncIcon = refreshBtn.querySelector('.sync-icon');
    const cacheTimeLabel = document.getElementById('cache-time');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterChips = document.getElementById('filter-chips');
    const releasesGrid = document.getElementById('releases-grid');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const emptyState = document.getElementById('empty-state');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const exportBtn = document.getElementById('export-btn');

    // Sidebar DOM Elements
    const composerSidebar = document.getElementById('composer-sidebar');
    const closeComposerBtn = document.getElementById('close-composer');
    const previewBadge = document.getElementById('preview-badge');
    const previewDate = document.getElementById('preview-date');
    const previewTextContent = document.getElementById('preview-text-content');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const optTags = document.getElementById('opt-tags');
    const optLink = document.getElementById('opt-link');
    const tweetSubmitBtn = document.getElementById('tweet-submit-btn');

    // Create and append backdrop dynamically
    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    document.body.appendChild(backdrop);

    // Initialize Toast Container
    const toastContainer = document.getElementById('toast-container');

    // Normalize type helpers
    function normalizeType(rawType) {
        const type = rawType.trim().toLowerCase();
        if (type.includes('feature')) return 'Feature';
        if (type.includes('deprecat')) return 'Deprecated';
        if (type.includes('bug') || type.includes('fix')) return 'Bug Fix';
        if (type.includes('change') || type.includes('chang')) return 'Change';
        if (type.includes('notice') || type.includes('announc')) return 'Notice';
        return 'General';
    }

    // Helper: Toast Notifications
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-close" aria-label="Close message">&times;</button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto-remove toast
        const removeTimeout = setTimeout(() => {
            toast.style.animation = 'slideInLeft var(--transition-fast) reverse forwards';
            toast.addEventListener('animationend', () => toast.remove());
        }, 4000);

        // Manual close click
        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(removeTimeout);
            toast.remove();
        });
    }

    // Parse feed entries into granular, single-topic updates
    function segmentReleases(rawReleases) {
        const updates = [];
        let idCounter = 1;

        rawReleases.forEach((release) => {
            const parser = new DOMParser();
            // Wrap in div to guarantee a single parent element
            const doc = parser.parseFromString(`<div>${release.content}</div>`, 'text/html');
            const root = doc.querySelector('div');

            const children = Array.from(root.childNodes);
            let currentType = 'General';
            let tempContainer = document.createElement('div');

            children.forEach((child) => {
                if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'h3') {
                    // Save the preceding update segment if it contains content
                    if (tempContainer.innerHTML.trim() !== '') {
                        updates.push({
                            id: `${release.id || 'rel'}-${idCounter++}`,
                            date: release.title,
                            type: normalizeType(currentType),
                            html: tempContainer.innerHTML,
                            text: tempContainer.textContent.replace(/\s+/g, ' ').trim(),
                            link: release.link,
                            rawEntryId: release.id
                        });
                        tempContainer = document.createElement('div');
                    }
                    currentType = child.textContent.trim();
                } else {
                    tempContainer.appendChild(child.cloneNode(true));
                }
            });

            // Save the final update segment
            if (tempContainer.innerHTML.trim() !== '') {
                updates.push({
                    id: `${release.id || 'rel'}-${idCounter++}`,
                    date: release.title,
                    type: normalizeType(currentType),
                    html: tempContainer.innerHTML,
                    text: tempContainer.textContent.replace(/\s+/g, ' ').trim(),
                    link: release.link,
                    rawEntryId: release.id
                });
            }
        });

        return updates;
    }

    // Load releases from backend Flask API
    async function fetchReleases(forceRefresh = false) {
        // UI states: Loading
        refreshBtn.disabled = true;
        syncIcon.classList.add('spinning');
        skeletonLoader.style.display = 'grid';
        releasesGrid.style.display = 'none';
        emptyState.style.display = 'none';

        try {
            const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Server returned an error');
            }

            releases = data.releases || [];
            parsedUpdates = segmentReleases(releases);

            // Set warning toast if cache failure
            if (data.warning) {
                showToast(data.warning, 'warning');
            } else if (forceRefresh) {
                showToast('Release notes updated successfully!', 'success');
            }

            // Set Cache Last Updated time
            if (data.cached_at) {
                const date = new Date(data.cached_at * 1000);
                cacheTimeLabel.textContent = `Updated: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }

            renderGrid();
        } catch (error) {
            console.error('Fetch error:', error);
            showToast(`Error fetching release notes: ${error.message}`, 'error');
            
            // If we have previous updates, don't show empty state
            if (parsedUpdates.length === 0) {
                skeletonLoader.style.display = 'none';
                emptyState.style.display = 'flex';
            }
        } finally {
            refreshBtn.disabled = false;
            syncIcon.classList.remove('spinning');
            skeletonLoader.style.display = 'none';
        }
    }

    // Filter and Render the Updates Grid
    function renderGrid() {
        releasesGrid.innerHTML = '';

        // Filter updates based on Chip selection and Search string
        const filtered = parsedUpdates.filter(update => {
            const matchesFilter = activeFilter === 'all' || update.type === activeFilter;
            const matchesSearch = searchQuery === '' || 
                update.text.toLowerCase().includes(searchQuery) ||
                update.date.toLowerCase().includes(searchQuery) ||
                update.type.toLowerCase().includes(searchQuery);
            return matchesFilter && matchesSearch;
        });

        if (filtered.length === 0) {
            releasesGrid.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        releasesGrid.style.display = 'grid';

        filtered.forEach(update => {
            const isSelected = selectedUpdate && selectedUpdate.id === update.id;
            const card = document.createElement('div');
            card.className = `release-card ${isSelected ? 'selected' : ''}`;
            card.dataset.id = update.id;
            
            card.innerHTML = `
                <div class="select-indicator">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div class="card-header">
                    <span class="type-badge ${update.type.toLowerCase().replace(' ', '')}">${update.type}</span>
                    <span class="date-label">${update.date}</span>
                </div>
                <div class="card-body">
                    ${update.html}
                </div>
                <div class="card-footer">
                    <a href="${update.link}" target="_blank" rel="noopener noreferrer" class="learn-more-link" stop-propagation>
                        <span>View doc</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="7" y1="17" x2="17" y2="7"></line>
                            <polyline points="7 7 17 7 17 17"></polyline>
                        </svg>
                    </a>
                    <div class="card-actions-wrapper">
                        <button class="card-copy-btn" aria-label="Copy description to clipboard" stop-propagation>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                        <button class="card-tweet-btn" aria-label="Share this update on X" stop-propagation>
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            // Prevent link and actions click from triggering card selection
            card.querySelectorAll('[stop-propagation]').forEach(elem => {
                elem.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            });

            // Copy button click handler on card
            card.querySelector('.card-copy-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(update.text).then(() => {
                    showToast('Copied description to clipboard!', 'success');
                }).catch(err => {
                    showToast('Failed to copy text', 'error');
                });
            });

            // Tweet button click handler on card
            card.querySelector('.card-tweet-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                selectUpdate(update);
            });

            // Card body selection handler
            card.addEventListener('click', () => {
                if (selectedUpdate && selectedUpdate.id === update.id) {
                    deselectAll();
                } else {
                    selectUpdate(update);
                }
            });

            releasesGrid.appendChild(card);
        });
    }

    // Selection & Composer Management
    function selectUpdate(update) {
        selectedUpdate = update;
        
        // Update selected class on cards
        document.querySelectorAll('.release-card').forEach(card => {
            if (card.dataset.id === update.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Set composer contents
        previewBadge.className = `type-badge ${update.type.toLowerCase().replace(' ', '')}`;
        previewBadge.textContent = update.type;
        previewDate.textContent = update.date;
        previewTextContent.textContent = update.text;

        generateComposerTweet();
        
        // Open sidebar
        composerSidebar.classList.add('open');
        backdrop.classList.add('show');
    }

    function deselectAll() {
        selectedUpdate = null;
        document.querySelectorAll('.release-card').forEach(card => card.classList.remove('selected'));
        composerSidebar.classList.remove('open');
        backdrop.classList.remove('show');
    }

    // Generate Tweet Draft logic with surgical character count trimming
    function generateComposerTweet() {
        if (!selectedUpdate) return;
        
        let emoji = "📢";
        const type = selectedUpdate.type;
        if (type === 'Feature') emoji = "🚀";
        else if (type === 'Bug Fix') emoji = "🛠️";
        else if (type === 'Deprecated') emoji = "⚠️";
        else if (type === 'Change') emoji = "🔄";

        const prefix = `${emoji} BigQuery ${type} (${selectedUpdate.date}): `;
        const tags = optTags.checked ? " #BigQuery #GoogleCloud" : "";
        
        // X/Twitter always counts URLs as 23 characters (t.co redirection)
        const linkStr = (optLink.checked && selectedUpdate.link) ? ` ${selectedUpdate.link}` : "";
        const urlLength = (optLink.checked && selectedUpdate.link) ? 24 : 0; 
        
        const reservedLen = prefix.length + tags.length + urlLength;
        const maxTextLen = 280 - reservedLen - 4; // -4 for "..."

        let snippet = selectedUpdate.text;
        if (snippet.length > maxTextLen) {
            snippet = snippet.substring(0, maxTextLen).trim() + "...";
        }

        const tweetContent = `${prefix}${snippet}${tags}${linkStr}`;
        tweetTextarea.value = tweetContent;
        updateCharCounter();
    }

    function updateCharCounter() {
        const text = tweetTextarea.value;
        
        // Accurate character count accounting for Twitter t.co URL compression
        let length = text.length;
        if (selectedUpdate && optLink.checked && selectedUpdate.link) {
            // Replace the link in the text with a dummy 23 character t.co link for calculations
            const linkIndex = text.indexOf(selectedUpdate.link);
            if (linkIndex !== -1) {
                length = text.length - selectedUpdate.link.length + 23;
            }
        }

        charCounter.textContent = `${length} / 280`;

        charCounter.className = 'char-counter';
        if (length > 270 && length <= 280) {
            charCounter.classList.add('warning');
        } else if (length > 280) {
            charCounter.classList.add('danger');
        }
    }

    // Actions & Event Listeners
    refreshBtn.addEventListener('click', () => fetchReleases(true));

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        
        if (searchQuery !== '') {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        
        renderGrid();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderGrid();
    });

    // Chip Filter Clicks
    filterChips.addEventListener('click', (e) => {
        if (!e.target.classList.contains('chip')) return;
        
        filterChips.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
        e.target.classList.add('active');
        
        activeFilter = e.target.dataset.type;
        renderGrid();
    });

    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        
        filterChips.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
        filterChips.querySelector('[data-type="all"]').classList.add('active');
        activeFilter = 'all';
        
        renderGrid();
    });

    // Composer Sidebar Events
    closeComposerBtn.addEventListener('click', deselectAll);
    backdrop.addEventListener('click', deselectAll);

    optTags.addEventListener('change', generateComposerTweet);
    optLink.addEventListener('change', generateComposerTweet);

    tweetTextarea.addEventListener('input', updateCharCounter);

    tweetSubmitBtn.addEventListener('click', () => {
        const tweetText = tweetTextarea.value;
        const charCount = tweetText.length;
        
        // Calculate t.co adjusted length
        let adjustedLength = charCount;
        if (selectedUpdate && optLink.checked && selectedUpdate.link) {
            const linkIndex = tweetText.indexOf(selectedUpdate.link);
            if (linkIndex !== -1) {
                adjustedLength = tweetText.length - selectedUpdate.link.length + 23;
            }
        }

        if (adjustedLength > 280) {
            showToast('Tweet exceeds X (Twitter) 280 character limit!', 'error');
            return;
        }

        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
        showToast('Redirected to X (Twitter) share page!', 'success');
    });

    // Export to CSV logic (exports currently filtered releases)
    function exportToCSV() {
        const filtered = parsedUpdates.filter(update => {
            const matchesFilter = activeFilter === 'all' || update.type === activeFilter;
            const matchesSearch = searchQuery === '' || 
                update.text.toLowerCase().includes(searchQuery) ||
                update.date.toLowerCase().includes(searchQuery) ||
                update.type.toLowerCase().includes(searchQuery);
            return matchesFilter && matchesSearch;
        });

        if (filtered.length === 0) {
            showToast('No updates to export', 'warning');
            return;
        }

        // Build CSV String (respecting comma/quote escaping)
        let csvContent = "\uFEFF"; // UTF-8 BOM to support Excel encoding
        csvContent += "Date,Type,Description,Documentation Link\n";

        filtered.forEach(update => {
            const escapedDate = `"${update.date.replace(/"/g, '""')}"`;
            const escapedType = `"${update.type.replace(/"/g, '""')}"`;
            // Normalize newlines in description to spaces so CSV doesn't break
            const escapedText = `"${update.text.replace(/\r?\n|\r/g, ' ').replace(/"/g, '""')}"`;
            const escapedLink = `"${update.link.replace(/"/g, '""')}"`;
            
            csvContent += `${escapedDate},${escapedType},${escapedText},${escapedLink}\n`;
        });

        // Download CSV as Blob
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        const filterSuffix = activeFilter !== 'all' ? `_${activeFilter}` : '';
        link.setAttribute("download", `bigquery_releases${filterSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV file exported successfully!', 'success');
    }

    // Theme Switching Controller
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            themeToggle.checked = true;
        } else {
            document.body.classList.remove('light-theme');
            themeToggle.checked = false;
        }
    }

    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
            showToast('Switched to Light Mode', 'info');
        } else {
            document.body.classList.remove('light-theme');
            localStorage.setItem('theme', 'dark');
            showToast('Switched to Dark Mode', 'info');
        }
    });

    exportBtn.addEventListener('click', exportToCSV);

    // Initialize Theme
    initTheme();

    // Initial Load
    fetchReleases();
});
