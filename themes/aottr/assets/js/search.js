// Search functionality using Fuse.js
let searchIndex = null;
let fuse = null;

function openSearchModal() {
  const searchModal = document.getElementById('search-modal');
  const searchInput = document.getElementById('search-input');
  
  if (!searchModal || !searchInput) {
    return;
  }
  
  searchModal.classList.remove('search-modal-hidden');
  searchModal.style.display = 'flex';
  
  searchInput.focus();
  document.body.style.overflow = 'hidden';
}

// Initialize search when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  const searchToggle = document.getElementById('search-toggle');
  const searchModal = document.getElementById('search-modal');
  const searchClose = document.getElementById('search-close');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  if (!searchToggle || !searchModal || !searchInput) {
    return;
  }

  // Open search modal
  searchToggle.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    openSearchModal();
  });

  // Close search modal
  function closeSearch() {
    searchModal.classList.add('search-modal-hidden');
    searchModal.style.display = 'none';
    searchInput.value = '';
    searchResults.innerHTML = '';
    document.body.style.overflow = '';
  }

  searchClose.addEventListener('click', closeSearch);

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && searchModal.style.display === 'flex') {
      closeSearch();
    }
  });

  // Close on background click
  searchModal.addEventListener('click', function(e) {
    if (e.target === searchModal) {
      closeSearch();
    }
  });

  // Load search index and initialize Fuse.js
  async function initializeSearch() {
    // Check if Fuse.js is loaded
    if (typeof Fuse === 'undefined') {
      console.error('Fuse.js is not loaded. Please ensure the Fuse.js script is loaded before search.js');
      return false;
    }

    try {
      const response = await fetch('/index.json');
      if (!response.ok) {
        throw new Error('Failed to load search index');
      }
      const data = await response.json();
      searchIndex = Array.isArray(data) ? data : (data.index || []);
      
      if (searchIndex.length === 0) {
        console.warn('Search index is empty');
        return false;
      }
      
      // Initialize Fuse.js
      fuse = new Fuse(searchIndex, {
        keys: [
          { name: 'title', weight: 0.7 },
          { name: 'content', weight: 0.3 },
          { name: 'tags', weight: 0.2 }
        ],
        threshold: 0.3, // 0.0 = exact match, 1.0 = match anything
        includeScore: true,
        minMatchCharLength: 2,
        ignoreLocation: true,
        findAllMatches: true
      });
      return true;
    } catch (error) {
      console.error('Error loading search index:', error);
      return false;
    }
  }

  // Initialize search
  const searchInitialized = await initializeSearch();
  if (!searchInitialized) {
    console.warn('Search initialization failed, but modal can still be opened');
  }

  // Perform search on input
  let searchTimeout;
  searchInput.addEventListener('input', function(e) {
    const query = e.target.value.trim();

    clearTimeout(searchTimeout);
    
    if (!query) {
      searchResults.innerHTML = '';
      return;
    }

    if (!fuse) {
      searchResults.innerHTML = '<p class="search-error">Search is not available. Please refresh the page.</p>';
      return;
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 150);
  });

  function performSearch(query) {
    const results = fuse.search(query);
    
    if (results.length === 0) {
      searchResults.innerHTML = '<p class="search-no-results">No articles found matching your search.</p>';
      return;
    }

    // Display results (limit to 10)
    const resultsHTML = results.slice(0, 10).map(result => {
      const item = result.item;
      const score = result.score;
      const title = highlightMatch(item.title, query);
      const summary = item.summary || item.content.substring(0, 150) + '...';
      const date = item.date ? new Date(item.date).toLocaleDateString() : '';
      const tags = item.tags && item.tags.length > 0 
        ? `<div class="search-result-tags">${item.tags.map(tag => `<span class="search-tag">${tag}</span>`).join('')}</div>`
        : '';

      return `
        <a href="${item.permalink}" class="search-result-item" onclick="document.getElementById('search-modal').style.display='none'; document.body.style.overflow='';">
          <h3 class="search-result-title">${title}</h3>
          ${date ? `<span class="search-result-date">${date}</span>` : ''}
          <p class="search-result-summary">${summary}</p>
          ${tags}
        </a>
      `;
    }).join('');

    searchResults.innerHTML = resultsHTML;
  }

  function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
});
