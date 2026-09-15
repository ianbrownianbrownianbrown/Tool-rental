(function () {
  const grid = document.querySelector('.tool-grid');
  const search = document.querySelector('#searchInput');
  const category = document.querySelector('#categoryFilter');
  const sort = document.querySelector('#sortFilter');
  const groups = { Drill: 'Power tools', Sander: 'Power tools', Ladder: 'Ladders' };
  const categoryIcons = { Drill: 'drill', Sander: 'hammer', Ladder: 'ruler', Auto: 'car', Request: 'messages-square' };
  function route() {
    const page = ['browse', 'list', 'request'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'browse';
    document.querySelectorAll('.page').forEach(section => { section.hidden = section.id !== page; });
    document.querySelector('#browseMasthead').hidden = page !== 'browse';
    document.querySelectorAll('[data-route]').forEach(link => {
      if (link.dataset.route === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
  function decorate() {
    document.querySelectorAll('.tool-image:not([data-decorated])').forEach(media => {
      const name = media.textContent.trim();
      const symbol = categoryIcons[name] || 'wrench';
      media.dataset.decorated = 'true';
      media.dataset.category = groups[name] || name;
      media.dataset.tone = { Drill: 'yellow', Ladder: 'blue', Sander: 'coral', Auto: 'green' }[name] || 'green';
      const mark = document.createElement('i'); mark.dataset.lucide = symbol; mark.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = name;
      media.replaceChildren(mark, label);
    });
    window.lucide?.createIcons();
  }
  function filter() {
    const query = search.value.trim().toLowerCase();
    const cards = [...grid.children];
    let count = 0;
    cards.forEach((card, index) => {
      if (!card.dataset.originalOrder) card.dataset.originalOrder = String(index + 1);
      const match = (!query || card.textContent.toLowerCase().includes(query)) && (!category.value || card.querySelector('.tool-image')?.dataset.category === category.value);
      card.hidden = !match; if (match) count++;
    });
    const price = card => Number(card.querySelector('p')?.textContent.match(/\$([\d.]+)/)?.[1] || 0);
    cards.sort((a,b) => sort.value === 'low' ? price(a)-price(b) : sort.value === 'high' ? price(b)-price(a) : Number(a.dataset.originalOrder)-Number(b.dataset.originalOrder));
    cards.forEach((card, index) => { card.style.order = index; });
    document.querySelector('#noMatches').hidden = !!count;
  }
  new MutationObserver(() => { decorate(); filter(); }).observe(grid, { childList: true });
  new MutationObserver(decorate).observe(document.querySelector('#listingPreview'), { childList: true });
  new MutationObserver(decorate).observe(document.querySelector('#requestPreview'), { childList: true });
  new MutationObserver(decorate).observe(document.querySelector('#requestList'), { childList: true });
  search.addEventListener('input', filter); category.addEventListener('change', filter); sort.addEventListener('change', filter);
  document.querySelector('#searchForm').addEventListener('submit', event => { event.preventDefault(); filter(); });
  window.addEventListener('hashchange', route);
  route(); decorate(); filter();
})();
