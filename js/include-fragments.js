document.addEventListener('DOMContentLoaded', async () => {
  const loadFragment = async (selector, path) => {
    const container = document.querySelector(selector);
    if (!container) return;
    try {
      const res = await fetch(path);
      if (!res.ok) return;
      const html = await res.text();
      container.innerHTML = html;
    } catch (err) {
      // ignore
    }
  };

  // load nav/footer from project root (supports sites where includes/ was removed)
  await Promise.all([
    loadFragment('#site-nav', '/nav.html'),
    loadFragment('#site-footer', '/footer.html')
  ]);

  // mark active nav link based on body data-page
  const page = document.body.dataset.page;
  if (page) {
    const nav = document.querySelector('[data-site-nav]');
    if (nav) {
      const active = nav.querySelector(`[data-nav="${page}"]`);
      if (active) active.classList.add('active');
    }
  }
  // small event for other scripts
  document.dispatchEvent(new Event('includes:loaded'));
});
