(function () {
  const body = document.body;
  const currentPage = body.dataset.page;
  const currentAdminPage = body.dataset.adminPage;

  // Initialize navigation after includes are loaded (handles timing when nav is injected)
  function setupNav() {
    const header = document.querySelector(".site-header");
    const navToggles = document.querySelectorAll("[data-nav-toggle]");
    const siteNavs = document.querySelectorAll("[data-site-nav], .site-nav");
    if (!header || navToggles.length === 0 || siteNavs.length === 0) return;
    if (header.dataset.navInitialized === "true") return;
    header.dataset.navInitialized = "true";

    // Toggle open/close for every nav toggle on the page (idempotent)
    console.debug('setupNav: found', navToggles.length, 'toggles and', siteNavs.length, 'nav containers on page', currentPage);
    navToggles.forEach((navToggle) => {
      if (navToggle.dataset.navBound === 'true') return;
      navToggle.addEventListener("click", () => {
        const isOpen = header.classList.toggle("is-open");
        body.classList.toggle("nav-open", isOpen);
        navToggles.forEach((t) => t.setAttribute("aria-expanded", String(isOpen)));
        navToggles.forEach((t) => t.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation"));
      });
      navToggle.dataset.navBound = 'true';
    });

    // Close nav when any nav link is clicked (handle multiple nav containers if present)
    siteNavs.forEach((siteNav) => {
      if (siteNav.dataset.navBound === 'true') return;
      siteNav.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
          header.classList.remove("is-open");
          body.classList.remove("nav-open");
          navToggles.forEach((t) => t.setAttribute("aria-expanded", "false"));
          navToggles.forEach((t) => t.setAttribute("aria-label", "Open navigation"));
        }
      });
      siteNav.dataset.navBound = 'true';
    });
  }

  if (currentPage) {
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === currentPage) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  if (currentAdminPage) {
    document.querySelectorAll("[data-admin-nav]").forEach((link) => {
      if (link.dataset.adminNav === currentAdminPage) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  // attempt to initialize now and also after includes are loaded
  // If the nav fragment hasn't been injected yet, watch the DOM and
  // initialize when a `[data-site-nav]` element appears. This avoids
  // a race where the includes load event fires before this script
  // attaches its listener in some environments.
  try { setupNav(); } catch (e) {}
  document.addEventListener('includes:loaded', setupNav);

  if (!document.querySelector('[data-site-nav]')) {
    const mo = new MutationObserver((records, observer) => {
      if (document.querySelector('[data-site-nav]')) {
        try { setupNav(); } catch (e) { /* ignore */ }
        observer.disconnect();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  const adminShell = document.querySelector("[data-admin-shell]");
  const adminToggle = document.querySelector("[data-admin-toggle]");
  const adminSidebar = document.querySelector(".admin-sidebar");

  if (adminShell && adminToggle && adminSidebar) {
    adminToggle.addEventListener("click", () => {
      const isOpen = adminShell.classList.toggle("is-open");
      body.classList.toggle("nav-open", isOpen);
      adminToggle.setAttribute("aria-expanded", String(isOpen));
      adminToggle.setAttribute("aria-label", isOpen ? "Close admin menu" : "Open admin menu");
    });

    adminSidebar.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        adminShell.classList.remove("is-open");
        body.classList.remove("nav-open");
        adminToggle.setAttribute("aria-expanded", "false");
        adminToggle.setAttribute("aria-label", "Open admin menu");
      }
    });

    adminShell.addEventListener("click", (event) => {
      if (event.target === adminShell) {
        adminShell.classList.remove("is-open");
        body.classList.remove("nav-open");
        adminToggle.setAttribute("aria-expanded", "false");
        adminToggle.setAttribute("aria-label", "Open admin menu");
      }
    });
  }

  const filterButtons = document.querySelectorAll("[data-filter]");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      const filterableCards = document.querySelectorAll("[data-category]");

      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      filterableCards.forEach((card) => {
        const shouldShow = filter === "all" || card.dataset.category === filter;
        card.classList.toggle("is-hidden", !shouldShow);
      });
    });
  });

  const amountInput = document.querySelector("[data-amount-input]");
  const amountButtons = document.querySelectorAll("[data-amount]");

  amountButtons.forEach((button) => {
    button.addEventListener("click", () => {
      amountButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      if (amountInput) {
        amountInput.value = button.dataset.amount;
        amountInput.focus();
      }
    });
  });

  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;

      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      button.setAttribute("aria-pressed", String(shouldShow));
      button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
    });
  });

  document.querySelectorAll("[data-feedback-form]").forEach((form) => {
    if (form.hasAttribute("data-supabase-form")) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const status = form.querySelector("[data-form-status]");
      if (status) {
        status.textContent = "Thank you. We will follow up with you shortly.";
      }
    });
  });

  // Daily Bread: fetch and render a daily verse (cache per day)
  async function fetchDailyVerse() {
    // try labs.bible.org random passage JSON
    const res = await fetch('https://labs.bible.org/api/?passage=random&type=json');
    if (!res.ok) throw new Error('Failed to fetch verse');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('No verse');
    const v = data[0];
    return {
      text: v.text.replace(/\s+/g, ' ').trim(),
      citation: `${v.bookname} ${v.chapter}:${v.verse}`
    };
  }

  async function renderDailyBread(forceRefresh = false) {
    const textEl = document.getElementById('daily-bread-text');
    const citeEl = document.getElementById('daily-bread-citation');
    const refreshBtn = document.getElementById('daily-bread-refresh');
    if (!textEl || !citeEl) return;

    const today = new Date().toISOString().slice(0,10);
    try {
      if (!forceRefresh && localStorage.getItem('dailyBreadDate') === today) {
        const cached = JSON.parse(localStorage.getItem('dailyBread') || 'null');
        if (cached) {
          textEl.textContent = cached.text;
          citeEl.textContent = cached.citation;
          return;
        }
      }

      textEl.textContent = 'Loading today\'s verse…';
      citeEl.textContent = '';
      const verse = await fetchDailyVerse();
      textEl.textContent = verse.text;
      citeEl.textContent = verse.citation;
      localStorage.setItem('dailyBreadDate', today);
      localStorage.setItem('dailyBread', JSON.stringify(verse));
    } catch (err) {
      textEl.textContent = 'Unable to load verse right now.';
      citeEl.textContent = '';
      console.warn('Daily Bread error', err);
    }
    // animate the Daily Bread card after rendering
    animateDailyBreadCard();
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderDailyBread(true);
      });
    }
  }

  function animateDailyBreadCard() {
    const card = document.querySelector('.daily-bread__card');
    if (!card) return;
    console.log('animateDailyBreadCard: found card', card);
    // restart animation if already applied
    card.classList.remove('animate-daily');
    card.classList.remove('float');
    // Force reflow to restart entrance animation
    // eslint-disable-next-line no-unused-expressions
    void card.offsetWidth;
    card.classList.add('animate-daily');
    // add float after entrance completes (respect reduced-motion)
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    console.log('animateDailyBreadCard: prefers-reduced-motion =', prefersReduced);
    if (!prefersReduced) {
      setTimeout(() => card.classList.add('float'), 350);
    }

    // Fallback: if the entrance animation isn't detected by the browser, apply it inline once.
    // This helps in edge-cases where CSS animations are blocked or classes aren't applied timely.
    if (!prefersReduced) {
      setTimeout(() => {
        try {
          const style = window.getComputedStyle(card);
          const animName = style.getPropertyValue('animation-name') || style.animationName;
          console.log('animateDailyBreadCard: computed animation-name =', animName);
          if (!animName || animName === 'none') {
            console.log('animateDailyBreadCard: forcing inline animation');
            card.style.animation = 'dailyBread-enter 320ms cubic-bezier(.22,.98,.41,1) both';
            setTimeout(() => {
              card.style.animation = '';
              // ensure float still applied
              if (!prefersReduced) card.classList.add('float');
            }, 340);
          }
        } catch (e) {
          console.warn('animateDailyBreadCard fallback error', e);
        }
      }, 450);
    }
  }

  // Run after includes are loaded (page fully interactive)
  document.addEventListener('includes:loaded', () => {
    renderDailyBread();
    // Prefill contact form if event info present in URL
    try { prefillContactFromQuery(); } catch (e) { /* ignore */ }
  });

  // Fallback: try to render/animate on DOMContentLoaded in case includes:loaded doesn't fire
  document.addEventListener('DOMContentLoaded', () => {
    const textEl = document.getElementById('daily-bread-text');
    if (!textEl) return;
    const initial = (textEl.textContent || '').trim();
    if (initial && !/loading/i.test(initial)) {
      // verse already present, just animate
      setTimeout(() => {
        console.log('DOMContentLoaded fallback: animating Daily Bread');
        animateDailyBreadCard();
      }, 150);
    } else {
      // otherwise render as usual
      renderDailyBread();
    }
  });

  // If the contact page is opened with event query params, prefill the message textarea
  function prefillContactFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('eventTitle');
    const date = params.get('eventDate');
    if (!title && !date) return;
    const messageEl = document.getElementById('contact-message');
    const nameEl = document.getElementById('contact-name');
    const emailEl = document.getElementById('contact-email');
    if (!messageEl) return;
    // Decode components for readability
    const decodedTitle = title ? decodeURIComponent(title) : '';
    const decodedDate = date ? decodeURIComponent(date) : '';
    const intro = decodedTitle ? `I'm enquiring about the event: ${decodedTitle}` : 'I have a question about an event';
    const dateInfo = decodedDate ? ` (${decodedDate})` : '';
    const prefill = `${intro}${dateInfo}.\n+\nPlease could you provide more details?`;
    messageEl.value = prefill;
    // Focus the message field for convenience
    messageEl.focus();
    // Optionally fill name/email from localStorage if available
    try {
      const savedName = localStorage.getItem('contactName');
      const savedEmail = localStorage.getItem('contactEmail');
      if (savedName && nameEl) nameEl.value = savedName;
      if (savedEmail && emailEl) emailEl.value = savedEmail;
    } catch (e) {}
  }

  // If a `map` query parameter is provided, update the contact page iframe to center on that location.
  function setContactMapFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const mapQuery = params.get('map');
    if (!mapQuery) return;
    const iframe = document.getElementById('contact-map-iframe');
    if (!iframe) return;
    // Known precise locations (lat,lng) for specific churches
    const special = {
      'Asaam SDA Church': '7.1224975,-1.4646131',
      'Nwaadan SDA Church': '7.1062128,-1.4596952',
      'Kofiase East SDA Church': '7.1394133,-1.4821827',
      'Kofiase Central SDA Church': '7.1399827,-1.4903494',
      'Kofiase Maranatha SDA Church': '7.1443314,-1.4916534',
      'Naama SDA Church': '7.1224975,-1.4646131',
      'Aframano SDA Church': '7.2172249,-1.5392849'
    };
    const decoded = decodeURIComponent(mapQuery);
    if (special[decoded]) {
      const coord = special[decoded];
      iframe.src = `https://www.google.com/maps?q=${coord}&z=18&output=embed`;
      return;
    }
    const q = encodeURIComponent(mapQuery);
    iframe.src = `https://www.google.com/maps?q=${q}&output=embed`;
  }

  // Call map updater after includes are loaded so the iframe is present
  document.addEventListener('includes:loaded', () => {
    try { setContactMapFromQuery(); } catch (e) { /* ignore */ }
  });

  // If the contact page is opened with event query params, prefill the message textarea
  // and show options to message via WhatsApp or send an email with the same prefilled content.
  function prefillContactFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('eventTitle');
    const date = params.get('eventDate');
    if (!title && !date) return;
    const messageEl = document.getElementById('contact-message');
    const nameEl = document.getElementById('contact-name');
    const emailEl = document.getElementById('contact-email');
    if (!messageEl) return;
    const decodedTitle = title ? decodeURIComponent(title) : '';
    const decodedDate = date ? decodeURIComponent(date) : '';
    const intro = decodedTitle ? `I'm enquiring about the event: ${decodedTitle}` : 'I have a question about an event';
    const dateInfo = decodedDate ? ` (${decodedDate})` : '';
    const prefill = `${intro}${dateInfo}.\n\nPlease could you provide more details?`;
    messageEl.value = prefill;
    messageEl.focus();

    // Build share links
    const share = document.getElementById('contact-share');
    if (share) {
      const phone = '233540460532';
      const waText = encodeURIComponent(prefill);
      const waHref = `https://wa.me/${phone}?text=${waText}`;
      const mailSubject = decodedTitle ? `Enquiry: ${decodedTitle}` : 'Event enquiry';
      const mailBody = encodeURIComponent(prefill);
      const mailHref = `mailto:info@kofiaseadventist.org?subject=${encodeURIComponent(mailSubject)}&body=${mailBody}`;
      share.innerHTML = `<div class="resources-cta"><a class="btn btn--ghost" href="${waHref}" target="_blank" rel="noopener">Message via WhatsApp</a><a class="btn btn--outline-gold" href="${mailHref}" target="_blank" rel="noopener">Send email</a></div>`;
      share.style.display = 'block';
      share.setAttribute('aria-hidden', 'false');
    }

    // Optionally fill name/email from localStorage if available
    try {
      const savedName = localStorage.getItem('contactName');
      const savedEmail = localStorage.getItem('contactEmail');
      if (savedName && nameEl) nameEl.value = savedName;
      if (savedEmail && emailEl) emailEl.value = savedEmail;
    } catch (e) {}
  }

  // Graceful handling for the current-quarter PDF link: verify file before navigating
  document.addEventListener('includes:loaded', () => {
    const pdfLink = document.querySelector('a[href="assets/resources/current-quarter.pdf"]');
    if (!pdfLink) return;

    pdfLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const href = pdfLink.getAttribute('href');
      try {
        const res = await fetch(href, { method: 'HEAD' });
        if (res.ok) {
          // Programmatically trigger a download so the PDF is saved instead of opened
          try {
            const filename = href.split('/').pop();
            const a = document.createElement('a');
            a.href = href;
            a.setAttribute('download', filename || 'download.pdf');
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            a.remove();
          } catch (err) {
            // fallback to opening in new tab if download can't be triggered
            window.open(href, '_blank');
          }
        } else {
          alert('PDF not found. Please contact the site admin or try the archive.');
          window.location.href = 'resources-archive.html';
        }
      } catch (err) {
        // fetch may fail on file:// protocol or due to CORS; provide fallback
        alert('Unable to download PDF from this environment. Please check the server or open the file directly.');
      }
    });
  });
})();
