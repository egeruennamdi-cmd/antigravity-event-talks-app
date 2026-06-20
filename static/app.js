/**
 * BigQuery Release Hub - Frontend JavaScript Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let rawReleaseNotes = [];
    let processedUpdates = [];
    let selectedUpdateIds = new Set();
    let currentFilter = 'all';
    let searchQuery = '';

    // DOM Elements
    const elements = {
        notesGrid: document.getElementById('notes-grid'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        emptyState: document.getElementById('empty-state'),
        errorMessage: document.getElementById('error-message'),
        btnRetry: document.getElementById('btn-retry'),
        btnRefresh: document.getElementById('btn-refresh'),
        btnExportCSV: document.getElementById('btn-export-csv'),
        syncStatus: document.getElementById('sync-status'),
        searchInput: document.getElementById('search-input'),
        searchClear: document.getElementById('search-clear'),
        filterTabs: document.querySelectorAll('.filter-tab'),
        floatingBar: document.getElementById('floating-bar'),
        selectionCount: document.getElementById('selection-count'),
        btnClearSelection: document.getElementById('btn-clear-selection'),
        btnTweetSelected: document.getElementById('btn-tweet-selected'),
        tweetModal: document.getElementById('tweet-modal'),
        tweetTextarea: document.getElementById('tweet-textarea'),
        btnCloseModal: document.getElementById('btn-close-modal'),
        btnPostTweet: document.getElementById('btn-post-tweet'),
        btnSimulateTweet: document.getElementById('btn-simulate-tweet'),
        charCounter: document.getElementById('char-counter'),
        progressRingBar: document.getElementById('progress-ring-bar'),
        toastContainer: document.getElementById('toast-container')
    };

    // Constant configurations
    const CHAR_LIMIT = 280;
    const RING_CIRCUMFERENCE = 62.8; // 2 * PI * r (r = 10)

    // ==========================================
    // Fetch and Processing Logic
    // ==========================================

    /**
     * Fetch release notes from backend Flask API
     */
    async function fetchReleaseNotes() {
        showState('loading');
        elements.btnRefresh.classList.add('spinning');
        elements.syncStatus.textContent = 'Syncing...';
        elements.syncStatus.className = 'sync-status syncing';

        try {
            const response = await fetch('/api/release-notes');
            const result = await response.json();
            
            if (result.success) {
                rawReleaseNotes = result.data;
                processReleaseNotes(rawReleaseNotes);
                
                elements.syncStatus.textContent = 'Synced just now';
                elements.syncStatus.className = 'sync-status';
                
                showToast('Successfully fetched latest release notes', 'success');
                renderGrid();
            } else {
                throw new Error(result.error || 'Server returned unsuccessful response');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            elements.errorMessage.textContent = `Error: ${error.message}. Please verify server connection.`;
            showState('error');
            elements.syncStatus.textContent = 'Sync failed';
            elements.syncStatus.className = 'sync-status';
            showToast('Failed to retrieve release notes', 'error');
        } finally {
            elements.btnRefresh.classList.remove('spinning');
        }
    }

    /**
     * Parse HTML structures of Atom feed entries into micro-release notes
     */
    function processReleaseNotes(entries) {
        processedUpdates = [];
        const parser = new DOMParser();

        entries.forEach((entry, index) => {
            const doc = parser.parseFromString(entry.content, 'text/html');
            const children = Array.from(doc.body.children);

            // If there's no recognizable structured content, treat as one entry
            if (children.length === 0) {
                processedUpdates.push({
                    id: `update-${index}-0`,
                    date: entry.title,
                    type: 'notice',
                    contentHtml: entry.content,
                    textSummary: stripHtml(entry.content),
                    link: entry.link || 'https://cloud.google.com/bigquery/docs/release-notes'
                });
                return;
            }

            let currentType = 'notice';
            let currentHtml = '';
            let subIndex = 0;

            children.forEach(child => {
                if (child.tagName === 'H3') {
                    // Push the accumulated block if it exists
                    if (currentHtml.trim() !== '') {
                        processedUpdates.push({
                            id: `update-${index}-${subIndex++}`,
                            date: entry.title,
                            type: currentType,
                            contentHtml: currentHtml,
                            textSummary: stripHtml(currentHtml),
                            link: entry.link || 'https://cloud.google.com/bigquery/docs/release-notes'
                        });
                    }
                    // Determine semantic type
                    const typeText = child.textContent.trim().toLowerCase();
                    if (typeText.includes('feature')) currentType = 'feature';
                    else if (typeText.includes('change')) currentType = 'change';
                    else if (typeText.includes('deprecation')) currentType = 'deprecation';
                    else if (typeText.includes('notice')) currentType = 'notice';
                    else currentType = 'change'; // Default fallback

                    currentHtml = '';
                } else {
                    currentHtml += child.outerHTML;
                }
            });

            // Push final block
            if (currentHtml.trim() !== '') {
                processedUpdates.push({
                    id: `update-${index}-${subIndex}`,
                    date: entry.title,
                    type: currentType,
                    contentHtml: currentHtml,
                    textSummary: stripHtml(currentHtml),
                    link: entry.link || 'https://cloud.google.com/bigquery/docs/release-notes'
                });
            }
        });
    }

    // ==========================================
    // UI Rendering Logic
    // ==========================================

    /**
     * Show UI panel states (loading, error, empty, grid)
     */
    function showState(state) {
        elements.loadingState.style.display = state === 'loading' ? 'flex' : 'none';
        elements.errorState.style.display = state === 'error' ? 'flex' : 'none';
        elements.emptyState.style.display = state === 'empty' ? 'flex' : 'none';
        elements.notesGrid.style.display = state === 'grid' ? 'grid' : 'none';
    }

    /**
     * Render the release notes list grid with filters applied
     */
    function renderGrid() {
        const filtered = getFilteredUpdates();

        if (filtered.length === 0) {
            showState('empty');
            return;
        }

        showState('grid');
        elements.notesGrid.innerHTML = '';

        filtered.forEach(item => {
            const card = document.createElement('article');
            card.className = `release-card ${selectedUpdateIds.has(item.id) ? 'selected' : ''}`;
            card.dataset.id = item.id;

            // HTML content format
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="release-date">${item.date}</span>
                        <span class="badge badge-${item.type}">
                            ${getBadgeIcon(item.type)}
                            ${item.type}
                        </span>
                    </div>
                    <button class="card-select-btn" aria-label="Select update for tweeting">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                    </button>
                </div>
                <div class="card-body">
                    ${item.contentHtml}
                </div>
                <div class="card-footer">
                    <div class="card-actions">
                        <button class="btn-card-tweet" id="btn-tweet-${item.id}">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            <span>Tweet</span>
                        </button>
                        <button class="btn-card-copy" id="btn-copy-${item.id}">
                            <svg class="icon-copy" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span class="btn-copy-text">Copy</span>
                        </button>
                    </div>
                    <a href="${item.link}" target="_blank" class="btn-card-details" rel="noopener noreferrer">Details</a>
                </div>
            `;

            // Card body link override so click doesn't trigger card selection and opens in new tab
            card.querySelectorAll('.card-body a').forEach(a => {
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
                a.addEventListener('click', e => {
                    e.stopPropagation();
                });
            });

            // Card selection click event
            card.addEventListener('click', (e) => {
                // Ignore clicks if click was on a button, copy button, or detail link
                if (e.target.closest('.btn-card-tweet') || e.target.closest('.btn-card-copy') || e.target.closest('.btn-card-details')) {
                    return;
                }
                toggleCardSelection(item.id);
            });

            // Single tweet button event
            card.querySelector('.btn-card-tweet').addEventListener('click', (e) => {
                e.stopPropagation();
                openTweetComposer([item]);
            });

            // Single copy button event
            card.querySelector('.btn-card-copy').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(item);
            });

            elements.notesGrid.appendChild(card);
        });
    }

    /**
     * Get processed items applying active filter tab and text search query
     */
    function getFilteredUpdates() {
        return processedUpdates.filter(item => {
            const matchesFilter = currentFilter === 'all' || item.type === currentFilter;
            const matchesSearch = searchQuery === '' || 
                item.date.toLowerCase().includes(searchQuery) ||
                item.type.toLowerCase().includes(searchQuery) ||
                item.textSummary.toLowerCase().includes(searchQuery);
            return matchesFilter && matchesSearch;
        });
    }

    // ==========================================
    // Selection Management
    // ==========================================

    /**
     * Toggle selection array state for card elements
     */
    function toggleCardSelection(id) {
        if (selectedUpdateIds.has(id)) {
            selectedUpdateIds.delete(id);
        } else {
            selectedUpdateIds.add(id);
        }
        
        // Reflect in UI
        const card = document.querySelector(`.release-card[data-id="${id}"]`);
        if (card) {
            card.classList.toggle('selected', selectedUpdateIds.has(id));
        }

        updateFloatingBar();
    }

    /**
     * Update bottom floating action dock visibility and counter text
     */
    function updateFloatingBar() {
        const count = selectedUpdateIds.size;
        if (count > 0) {
            elements.selectionCount.textContent = `${count} update${count > 1 ? 's' : ''} selected`;
            elements.floatingBar.classList.add('active');
        } else {
            elements.floatingBar.classList.remove('active');
        }
    }

    /**
     * Clear all selected items
     */
    function clearSelection() {
        selectedUpdateIds.clear();
        document.querySelectorAll('.release-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        updateFloatingBar();
    }

    // ==========================================
    // Twitter/X Composer System
    // ==========================================

    /**
     * Open Twitter composer dialog and construct post content
     */
    function openTweetComposer(items) {
        let tweetContent = '';

        if (items.length === 1) {
            const item = items[0];
            // Build a crisp post
            const cleanedText = item.textSummary.replace(/\s+/g, ' ').substring(0, 150).trim();
            tweetContent = `BigQuery Update (${item.date}): ${cleanedText}... \n\nRead details: ${item.link} #GCP #BigQuery`;
        } else {
            // Aggregate multiple updates sharing
            tweetContent = `Checked out the latest Google BigQuery Release Notes!\n\n`;
            items.forEach((item, idx) => {
                if (idx < 2) { // Show up to 2 items summary
                    const cleaned = item.textSummary.replace(/\s+/g, ' ').substring(0, 50).trim();
                    tweetContent += `• [${item.type.toUpperCase()}] ${cleaned}...\n`;
                }
            });
            tweetContent += `\nTrack details: https://cloud.google.com/bigquery/docs/release-notes #GCP #BigQuery`;
        }

        elements.tweetTextarea.value = tweetContent;
        updateCharCounter();
        elements.tweetModal.classList.add('active');
    }

    /**
     * Synchronize post characters remaining length and progress ring
     */
    function updateCharCounter() {
        const text = elements.tweetTextarea.value;
        const length = text.length;
        elements.charCounter.textContent = `${length} / ${CHAR_LIMIT}`;

        // Calculations for SVG progress ring
        const ratio = Math.min(length / CHAR_LIMIT, 1);
        const offset = RING_CIRCUMFERENCE - (ratio * RING_CIRCUMFERENCE);
        elements.progressRingBar.style.strokeDashoffset = offset;

        // Visual alerts based on boundaries
        if (length > CHAR_LIMIT) {
            elements.progressRingBar.setAttribute('stroke', '#EF4444'); // Red
            elements.charCounter.style.color = '#EF4444';
            elements.btnPostTweet.disabled = true;
        } else if (length >= CHAR_LIMIT - 30) {
            elements.progressRingBar.setAttribute('stroke', '#F59E0B'); // Orange/Amber
            elements.charCounter.style.color = '#F59E0B';
            elements.btnPostTweet.disabled = false;
        } else {
            elements.progressRingBar.setAttribute('stroke', '#10B981'); // Green
            elements.charCounter.style.color = 'var(--color-text-muted)';
            elements.btnPostTweet.disabled = false;
        }
    }

    // ==========================================
    // Event Listeners Registration
    // ==========================================

    // Refresh click action
    elements.btnRefresh.addEventListener('click', fetchReleaseNotes);
    elements.btnRetry.addEventListener('click', fetchReleaseNotes);
    elements.btnExportCSV.addEventListener('click', exportToCSV);

    // Search input handler
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        elements.searchClear.style.display = searchQuery ? 'block' : 'none';
        renderGrid();
    });

    // Clear search trigger
    elements.searchClear.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.searchClear.style.display = 'none';
        elements.searchInput.focus();
        renderGrid();
    });

    // Filter tabs handlers
    elements.filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderGrid();
        });
    });

    // Clear selection trigger
    elements.btnClearSelection.addEventListener('click', clearSelection);

    // Floating bar tweet trigger
    elements.btnTweetSelected.addEventListener('click', () => {
        const selectedItems = processedUpdates.filter(item => selectedUpdateIds.has(item.id));
        if (selectedItems.length > 0) {
            openTweetComposer(selectedItems);
        }
    });

    // Modal close triggers
    elements.btnCloseModal.addEventListener('click', () => {
        elements.tweetModal.classList.remove('active');
    });

    // Click outside modal-box to close it
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) {
            elements.tweetModal.classList.remove('active');
        }
    });

    // Update counter on keypress in post editor
    elements.tweetTextarea.addEventListener('input', updateCharCounter);

    // Actual X/Twitter Post Intent trigger
    elements.btnPostTweet.addEventListener('click', () => {
        const tweetText = elements.tweetTextarea.value;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        elements.tweetModal.classList.remove('active');
        clearSelection();
        showToast('Navigated to Twitter/X to post your update!', 'success');
    });

    // Mock Simulation action
    elements.btnSimulateTweet.addEventListener('click', () => {
        elements.tweetModal.classList.remove('active');
        clearSelection();
        showToast('Post simulated successfully! 🚀 (Self-contained mockup)', 'success');
    });

    // ==========================================
    // Utility Helpers
    // ==========================================

    /**
     * Extract plain text content from html markup
     */
    function stripHtml(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    /**
     * Map release types to beautiful icons
     */
    function getBadgeIcon(type) {
        switch (type) {
            case 'feature':
                return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            case 'change':
                return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
            case 'deprecation':
                return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
            case 'notice':
            default:
                return `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }
    }

    /**
     * Display a floating popup toast feedback element
     */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' 
            ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10B981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#EF4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
            
        toast.innerHTML = `
            ${icon}
            <span class="toast-message">${message}</span>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        // Animate out and remove
        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3500);
    }

    /**
     * Copy release note text content to system clipboard
     */
    function copyToClipboard(item) {
        const text = `BigQuery Update (${item.date}) [${item.type.toUpperCase()}]: ${item.textSummary.replace(/\s+/g, ' ').trim()}\nRead more: ${item.link}`;
        
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById(`btn-copy-${item.id}`);
            if (btn) {
                btn.classList.add('copied');
                const textSpan = btn.querySelector('.btn-copy-text');
                const originalHtml = btn.innerHTML;
                
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span class="btn-copy-text">Copied!</span>
                `;
                
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = originalHtml;
                }, 2000);
            }
            showToast('Copied update to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy to clipboard', 'error');
        });
    }

    /**
     * Export currently filtered release notes to a CSV file download
     */
    function exportToCSV() {
        const filtered = getFilteredUpdates();
        if (filtered.length === 0) {
            showToast('No updates available to export', 'error');
            return;
        }

        // CSV Headers
        const headers = ['Date', 'Type', 'Description Summary', 'Reference Link'];
        
        // Convert items to CSV rows
        const rows = filtered.map(item => {
            const cleanedText = item.textSummary.replace(/\s+/g, ' ').trim();
            // Escape double quotes by doubling them
            return [
                item.date,
                item.type.toUpperCase(),
                cleanedText,
                item.link
            ].map(val => `"${val.replace(/"/g, '""')}"`).join(',');
        });

        // Combine headers and rows
        const csvContent = [headers.join(','), ...rows].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery_release_notes_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`Exported ${filtered.length} updates to CSV successfully!`, 'success');
    }

    // Initialize application loading
    fetchReleaseNotes();
});
