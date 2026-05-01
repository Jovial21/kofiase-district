(function () {
  const config = window.KOFIASE_SUPABASE || {};
  const rootPrefix = window.location.pathname.includes("/admin/") ? "../" : "";
  const isConfigured =
    Boolean(config.url) &&
    Boolean(config.anonKey) &&
    !config.url.includes("YOUR_PROJECT_ID") &&
    !config.anonKey.includes("YOUR_SUPABASE");

  const client =
    isConfigured && window.supabase
      ? window.supabase.createClient(config.url, config.anonKey, {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true
          }
        })
      : null;

  window.KofiaseBackend = {
    client,
    isConfigured
  };

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  function asset(path) {
    if (!path) return "";
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    return rootPrefix + path.replace(/^(\.\.\/|\.\/)/, "");
  }

  function youtubeEmbedUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, "");
      const playlist = parsed.searchParams.get("list");
      let videoId = "";

      if (host === "youtu.be") {
        videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
      } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
        if (parsed.pathname === "/watch") {
          videoId = parsed.searchParams.get("v") || "";
        } else {
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (["embed", "shorts", "live"].includes(parts[0])) {
            videoId = parts[1] || "";
          }
        }
      }

      if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}`;
      if (playlist) return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlist)}`;
    } catch (error) {
      return "";
    }
    return "";
  }

  function uniqueId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function setStatus(form, message, type) {
    const status = form.querySelector("[data-form-status]");
    if (status) {
      status.textContent = message;
      status.dataset.type = type || "info";
    }
  }

  function requireClient(form) {
    if (client) return true;
    if (form) {
      setStatus(form, "Add your Supabase URL and anon key in js/supabase-config.js.", "error");
    }
    return false;
  }

  function showSetupNotice() {
    if (client || !document.querySelector(".admin-body")) return;
    const content = document.querySelector(".admin-content");
    if (!content || document.querySelector(".admin-setup-notice")) return;
    const notice = document.createElement("section");
    notice.className = "admin-panel admin-setup-notice";
    notice.innerHTML = '<p class="kicker">Supabase Setup</p><h2>Backend Not Connected Yet</h2><p>Add your project URL and anon key in <code>js/supabase-config.js</code>, then run <code>supabase/schema.sql</code> in the Supabase SQL editor.</p>';
    content.prepend(notice);
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function dateParts(value) {
    if (!value) return { month: "TBD", day: "--" };
    const date = new Date(`${value}T00:00:00`);
    return {
      month: date.toLocaleDateString("en-US", { month: "short" }),
      day: date.toLocaleDateString("en-US", { day: "2-digit" })
    };
  }

  function sermonCategoryKey(value) {
    const category = String(value || "").toLowerCase();
    if (category.includes("youth")) return "youth";
    if (category.includes("study")) return "study";
    return "worship";
  }

  function money(value) {
    const number = Number(value || 0);
    return `GHS ${number.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }

  function pill(status) {
    const value = status || "draft";
    const className = value === "published" || value === "recorded" || value === "resolved"
      ? "status-pill--live"
      : value === "unread" || value === "scheduled" || value === "featured"
        ? "status-pill--new"
        : "status-pill--draft";
    return `<span class="status-pill ${className}">${value.replace(/^\w/, (letter) => letter.toUpperCase())}</span>`;
  }

  async function guardAdmin() {
    const page = document.body.dataset.adminPage;
    if (!page || page === "login" || !client) return;

    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "login.html";
      return;
    }

    const { data: profile, error } = await client
      .from("admin_profiles")
      .select("display_name, role")
      .eq("id", sessionData.session.user.id)
      .maybeSingle();

    if (error || !profile) {
      await client.auth.signOut();
      window.location.href = "login.html";
      return;
    }

    const user = document.querySelector(".admin-user");
    if (user) {
      user.innerHTML = `<strong>${profile.display_name || "Admin"}</strong><span>${profile.role || "Admin"}</span>`;
    }
  }

  function initLogin() {
    const form = document.querySelector("[data-admin-login]");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!requireClient(form)) return;

      setStatus(form, "Signing in...", "info");
      const email = form.querySelector("#admin-email").value.trim();
      const password = form.querySelector("#admin-password").value;
      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error) {
        setStatus(form, error.message, "error");
        return;
      }

      const { data: profile } = await client
        .from("admin_profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile) {
        await client.auth.signOut();
        setStatus(form, "This account is not registered as an admin.", "error");
        return;
      }

      window.location.href = "dashboard.html";
    });
  }

  function values(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  const ministryDefaults = {
    youth: {
      slug: "youth",
      name: "Youth Ministry",
      page_url: "youth.html",
      summary: "Youth camp, mini camps, AY programs, leadership, evangelism, and service projects for young people.",
      focus_title: "Faith That Becomes Service",
      focus_body: "Helping young people build a personal walk with Jesus, grow in Scripture, serve their communities, and use their gifts in worship and mission.",
      programs: ["Youth Camp", "Mini Camps", "AY Programs", "Leadership Training", "Fellowship & Recreation"],
      status: "published"
    },
    women: {
      slug: "women",
      name: "Women's Ministry",
      page_url: "women.html",
      summary: "Prayer circles, Bible study, mentoring, family support, fellowship, and compassionate outreach.",
      focus_title: "Discipleship With A Caring Heart",
      focus_body: "Encouraging women to grow in Christ, support one another, strengthen families, and serve the church and community with compassion.",
      programs: ["Prayer Circles", "Bible Study", "Mentorship", "Family Life Support", "Compassionate Outreach", "Skills & Stewardship"],
      status: "published"
    },
    children: {
      slug: "children",
      name: "Children's Ministry",
      page_url: "children.html",
      summary: "Sabbath School, Bible stories, memory verses, songs, creative lessons, and safe spiritual care for children.",
      focus_title: "Faith Foundations For Little Hearts",
      focus_body: "Helping children know that Jesus loves them, understand Bible truth in simple ways, and feel at home in the church family.",
      programs: ["Sabbath School", "Bible Stories", "Memory Verses", "Children's Worship", "Creative Lessons", "Family Support"],
      status: "published"
    },
    health: {
      slug: "health",
      name: "Health Ministry",
      page_url: "health.html",
      summary: "Wellness seminars, screenings, nutrition education, mental wellbeing, and community health outreach.",
      focus_title: "Serving Body, Mind, and Spirit",
      focus_body: "Encouraging members and the wider community to care for the body as God's gift while growing in balanced spiritual, mental, and physical wellbeing.",
      programs: ["Wellness Seminars", "Health Screenings", "Nutrition Education", "Exercise & Activity", "Mental Wellbeing", "Community Outreach"],
      status: "published"
    },
    personal: {
      slug: "personal",
      name: "Personal Ministries",
      page_url: "about.html#ministries",
      summary: "Training and outreach that equip members to share their faith naturally.",
      focus_title: "Every Member In Mission",
      focus_body: "Equipping members to witness, visit, study the Bible with others, and participate in practical evangelism.",
      programs: ["Bible Worker Support", "Visitation", "Evangelism Training", "Literature Sharing", "Follow-up Care"],
      status: "published"
    }
  };

  function programList(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function programsFromText(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function adminPageUrl(value) {
    if (!value) return "../about.html#ministries";
    if (/^(https?:|mailto:|tel:)/.test(value)) return value;
    return `../${value.replace(/^(\.\.\/|\.\/)/, "")}`;
  }

  function fillMinistryForm(form, ministry) {
    if (!form || !ministry) return;
    const set = (selector, value) => {
      const input = form.querySelector(selector);
      if (input && value !== undefined && value !== null) input.value = value;
    };
    set("#ministry-slug", ministry.slug);
    set("#ministry-name", ministry.name);
    set("#ministry-page", ministry.page_url);
    set("#ministry-summary", ministry.summary);
    set("#ministry-focus-title", ministry.focus_title);
    set("#ministry-focus-body", ministry.focus_body);
    set("#ministry-programs", programList(ministry.programs).join("\n"));
    set("#ministry-status", ministry.status || "published");
  }

  function initMinistryEditor() {
    const form = document.querySelector("[data-supabase-form='ministry']");
    const slugInput = form ? form.querySelector("#ministry-slug") : null;
    if (!form || !slugInput) return;

    function handleSlugChange() {
      const loaded = form._ministriesBySlug || {};
      const val = (slugInput.value || "").trim();
      const heading = form.querySelector("h2");
      if (loaded[val]) {
        if (heading) heading.textContent = "Update Ministry";
        fillMinistryForm(form, loaded[val]);
      } else if (val) {
        if (heading) heading.textContent = "Create Ministry";
        // prepare empty form for creating a new ministry
        form.querySelector("#ministry-name").value = val.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
        form.querySelector("#ministry-page").value = `${val.replace(/\s+/g, "-").toLowerCase()}.html`;
        form.querySelector("#ministry-summary").value = "";
        form.querySelector("#ministry-focus-title").value = "";
        form.querySelector("#ministry-focus-body").value = "";
        form.querySelector("#ministry-programs").value = "";
        form.querySelector("#ministry-status").value = "published";
      }
    }

    slugInput.addEventListener("change", handleSlugChange);
    slugInput.addEventListener("input", handleSlugChange);
  }

  async function submitContact(form) {
    const data = values(form);
    const { error } = await client.from("messages").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      topic: data.topic || "Website message",
      message: data.message,
      status: "unread"
    });
    if (error) throw error;
    form.reset();
    setStatus(form, "Thank you. Your message has been sent.", "success");

    // Attempt to open user's mail client and WhatsApp to send a copy to admin.
    try {
      const adminEmail = 'info@kofiaseadventist.org';
      const adminPhone = '233540460532';
      const subject = encodeURIComponent(data.topic || 'Website message');
      const bodyLines = [];
      if (data.name) bodyLines.push(`From: ${data.name}`);
      if (data.email) bodyLines.push(`Email: ${data.email}`);
      if (data.topic) bodyLines.push(`Topic: ${data.topic}`);
      if (data.message) bodyLines.push(`Message:\n${data.message}`);
      const body = encodeURIComponent(bodyLines.join('\n\n'));

      // Open mail client (may be blocked by popup blockers)
      const mailto = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
      window.open(mailto, '_blank');

      // Open WhatsApp web/mobile (may be blocked)
      const waHref = `https://wa.me/${adminPhone}?text=${body}`;
      window.open(waHref, '_blank');
    } catch (e) {
      // ignore errors — sharing links are optional
      console.warn('Could not open share links', e);
    }
  }

  async function submitPublicGiving(form) {
    const data = values(form);
    const amount = Number(data.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setStatus(form, 'Enter a valid amount greater than 0.', 'error');
      return;
    }

    const { data: inserted, error } = await client.from("giving_records").insert({
      giver_name: data.name || "Anonymous",
      email: data.email || null,
      phone: data.phone || null,
      fund: data.fund,
      amount: amount,
      payment_channel: data.payment_channel || null,
      reference: data.reference || null,
      status: "pending",
      received_at: new Date().toISOString()
    }).select('id');
    if (error) throw error;
    form.reset();
    setStatus(form, "Thank you. Your giving entry has been received.", "success");

    // Show quick confirmation and an optional 'I have paid' action that marks the record as recorded
    try {
      const id2 = inserted && inserted[0] && inserted[0].id;
      if (id2) {
        const container = document.createElement('div');
        container.className = 'giving-confirmation';
        container.innerHTML = `<p>We've recorded your intention (ID: ${id2}). Use the phone number shown on this page to transfer, then click below to notify the office.</p><div><button class="btn btn--outline-gold" id="giving-mark-paid" data-id="${id2}">I have paid — Notify Office</button></div>`;
        form.parentNode.insertBefore(container, form.nextSibling);
        const btn = container.querySelector('#giving-mark-paid');
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Notifying...';
          const { error: markErr } = await client.from('giving_records').update({ status: 'recorded', recorded_at: new Date().toISOString() }).eq('id', id2);
          if (markErr) {
            btn.disabled = false;
            btn.textContent = 'I have paid — Notify Office';
            setStatus(form, 'Could not notify office. Try again.', 'error');
            console.error('Mark giving recorded error', markErr);
            return;
          }
          btn.textContent = 'Notified';
          setStatus(form, 'Thanks — the office has been notified.', 'success');
          loadAdminGiving();
        });
      }
    } catch (e) {
      console.warn('Could not show giving confirmation', e);
    }
  }

  

  // Optional helper to mark a giving record as recorded from admin or client
  async function markGivingAsRecorded(recordId) {
    if (!client) return { error: new Error('No client') };
    const { error } = await client.from('giving_records').update({ status: 'recorded', recorded_at: new Date().toISOString() }).eq('id', recordId);
    return { error };
  }

  async function submitSermon(form) {
    const payload = {
      title: form.querySelector("#sermon-title").value.trim(),
      speaker: form.querySelector("#sermon-speaker").value.trim(),
      sermon_date: form.querySelector("#sermon-date").value,
      category: form.querySelector("#sermon-series").value,
      video_url: form.querySelector("#sermon-link").value.trim(),
      thumbnail_url: form.querySelector("#sermon-thumbnail")?.value.trim() || null,
      summary: form.querySelector("#sermon-summary").value.trim(),
      status: form.querySelector("#sermon-status")?.value || "draft"
    };

    const editingId = form.dataset.sermonId;
    if (editingId) {
      const { error } = await client.from("sermons").update(payload).eq("id", editingId);
      if (error) throw error;
      setStatus(form, "Sermon updated.", "success");
      delete form.dataset.sermonId;
      const submitBtn = form.querySelector("button[type=submit]");
      if (submitBtn) submitBtn.textContent = "Save Sermon";
      const cancelBtn = form.querySelector("[data-cancel-edit]");
      if (cancelBtn) cancelBtn.remove();
    } else {
      const { error } = await client.from("sermons").insert(payload);
      if (error) throw error;
      setStatus(form, "Sermon saved.", "success");
    }

    form.reset();
    loadAdminSermons();
  }

  async function submitEvent(form) {
    const { error } = await client.from("events").insert({
      title: form.querySelector("#event-title").value.trim(),
      event_date: form.querySelector("#event-date").value,
      start_time: form.querySelector("#event-time").value || null,
      ministry: form.querySelector("#event-ministry").value,
      location: form.querySelector("#event-location").value.trim(),
      description: form.querySelector("#event-description").value.trim(),
      image_url: form.querySelector("#event-image-url")?.value.trim() || null,
      status: form.querySelector("#event-status")?.value || "draft"
    });
    if (error) throw error;
    form.reset();
    setStatus(form, "Event saved.", "success");
    loadAdminEvents();
  }

  // Normalize phone numbers to E.164-ish digits for WhatsApp links (basic Ghana handling)
  function normalizePhone(raw) {
    if (!raw) return null;
    const digits = String(raw).replace(/[^0-9+]/g, '');
    if (!digits) return null;
    let d = digits.replace(/^\+/, '');
    // If starts with 0 and looks like local number, replace leading 0 with country code 233
    if (d.startsWith('0')) {
      d = '233' + d.slice(1);
    }
    // If looks like 9 digits (local without leading 0), prefix 233
    if (d.length === 9) {
      d = '233' + d;
    }
    return d;
  }

  async function submitGallery(form) {
    const fileInput = form.querySelector("#gallery-file");
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    let imageUrl = null;

    if (file) {
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
      const filePath = `${new Date().getFullYear()}/${uniqueId()}.${extension}`;
      const { error: uploadError } = await client.storage
        .from("gallery")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        });
      if (uploadError) throw uploadError;

      const { data } = client.storage.from("gallery").getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }

    if (!imageUrl) {
      throw new Error("Upload an image.");
    }

    const rawTitle = form.querySelector("#gallery-title")?.value?.trim();
    const generatedTitle = rawTitle || (file ? file.name.replace(/\.[^.]+$/, "") : `Photo ${new Date().toISOString()}`);
    const category = form.querySelector("#gallery-category")?.value || "worship";
    const caption = form.querySelector("#gallery-caption")?.value?.trim() || null;
    const altText = caption || generatedTitle;

    const { error } = await client.from("gallery_items").insert({
      title: generatedTitle,
      category: category,
      image_url: imageUrl,
      alt_text: altText,
      taken_on: null,
      caption: caption,
      status: "published"
    });
    if (error) throw error;
    form.reset();
    setStatus(form, "Gallery photo saved.", "success");
    loadAdminGallery();
  }

  async function submitAnnouncement(form) {
    const data = values(form);
    const { error } = await client.from("announcements").insert({
      title: data.title,
      ministry: data.ministry,
      announcement_date: data.announcement_date,
      summary: data.summary,
      body: data.body,
      link_url: data.link_url,
      link_label: data.link_label,
      priority: data.priority || "normal",
      status: data.status || "draft",
      expires_on: data.expires_on || null
    });
    if (error) throw error;
    form.reset();
    setStatus(form, "Announcement saved.", "success");
    loadAdminAnnouncements();
  }

  async function submitMinistry(form) {
    const data = values(form);
    const payload = {
      slug: data.slug,
      name: data.name,
      page_url: data.page_url,
      summary: data.summary,
      focus_title: data.focus_title,
      focus_body: data.focus_body,
      programs: programsFromText(data.programs),
      status: data.status || "published",
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from("ministries").upsert(payload, { onConflict: "slug" });
    if (error) throw error;
    setStatus(form, "Ministry saved.", "success");
    loadAdminMinistries();
  }

  async function submitAdminGiving(form) {
    const { error } = await client.from("giving_records").insert({
      giver_name: form.querySelector("#gift-name").value.trim() || "Anonymous",
      fund: form.querySelector("#gift-fund").value,
      amount: Number(form.querySelector("#gift-amount").value),
      reference: form.querySelector("#gift-reference").value.trim(),
      status: "recorded",
      received_at: form.querySelector("#gift-date").value
    });
    if (error) throw error;
    form.reset();
    setStatus(form, "Giving record saved.", "success");
    loadAdminGiving();
  }

  async function submitReply(form) {
    const messageId = form.dataset.messageId;
    if (!messageId) {
      setStatus(form, "Choose a message first.", "error");
      return;
    }
    const reply = form.querySelector("#reply-message").value.trim();
    // Fetch original message to get recipient email and topic
    const { data: original, error: fetchErr } = await client.from("messages").select("email,phone,name,topic").eq("id", messageId).single();
    if (fetchErr) {
      setStatus(form, "Could not load message details.", "error");
      throw fetchErr;
    }

    const { error } = await client
      .from("messages")
      .update({ reply, status: "resolved", replied_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) throw error;

    form.reset();
    setStatus(form, "Reply saved and message marked resolved.", "success");
    loadAdminMessages();

    // Attempt to open WhatsApp to send the reply to the user's phone.
    try {
      const rawPhone = (original && original.phone) ? original.phone : null;
      const normalized = normalizePhone(rawPhone);
      const text = reply || '';
      if (normalized) {
        const waHref = `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
        window.open(waHref, '_blank');
      } else {
        setStatus(form, 'Recipient has no phone number. Reply saved but could not open WhatsApp.', 'info');
      }
    } catch (e) {
      console.warn('Could not open WhatsApp for reply', e);
    }
  }

  async function submitSettings(form, type) {
    const payload = type === "profile"
      ? {
          name: form.querySelector("#site-name").value,
          tagline: form.querySelector("#site-tagline").value,
          location: form.querySelector("#site-location").value,
          phone: form.querySelector("#site-phone").value,
          email: form.querySelector("#site-email").value,
          tiktok_url: form.querySelector("#site-tiktok")?.value || "",
          resources: {
            adventist_org: form.querySelector("#site-link-adventist")?.value || "",
            ssnet: form.querySelector("#site-link-ssnet")?.value || "",
            youversion: form.querySelector("#site-link-youversion")?.value || "",
            youth_gc: form.querySelector("#site-link-youth")?.value || "",
            hopechannel: form.querySelector("#site-link-hope")?.value || "",
            children: form.querySelector("#site-link-children")?.value || ""
          }
        }
      : {
          sabbath: form.querySelector("#sabbath-time").value,
          bible_study: form.querySelector("#study-time").value,
          prayer: form.querySelector("#prayer-time").value,
          live_status: form.querySelector("#live-status").value
        };

    const { error } = await client
      .from("site_settings")
      .upsert({ key: type, value: payload, updated_at: new Date().toISOString() });
    if (error) throw error;
    setStatus(form, "Settings saved.", "success");
  }

  function initSupabaseForms() {
    document.querySelectorAll("[data-supabase-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!requireClient(form)) return;

        setStatus(form, "Saving...", "info");
        try {
          const type = form.dataset.supabaseForm;
          if (type === "contact") await submitContact(form);
          if (type === "giving-public") await submitPublicGiving(form);
          if (type === "sermon") await submitSermon(form);
          if (type === "event") await submitEvent(form);
          if (type === "gallery") await submitGallery(form);
          if (type === "announcement") await submitAnnouncement(form);
          if (type === "ministry") await submitMinistry(form);
          if (type === "giving-admin") await submitAdminGiving(form);
          if (type === "message-reply") await submitReply(form);
          if (type === "settings-profile") await submitSettings(form, "profile");
          if (type === "settings-schedule") await submitSettings(form, "schedule");
        } catch (error) {
          setStatus(form, error.message || "Something went wrong.", "error");
        }
      });
    });
  }

  async function loadPublicEvents() {
    if (!client) return;
    const homeList = document.querySelector("[data-public-events]");
    const pageList = document.querySelector("[data-public-events-list]");
    if (!homeList && !pageList) return;

    const { data, error } = await client
      .from("events")
      .select("title,event_date,start_time,location,description,image_url,status")
      .in("status", ["published", "featured"])
      .order("event_date", { ascending: true })
      .limit(pageList ? 12 : 3);
    if (error || !data || !data.length) return;

    if (homeList) {
      homeList.innerHTML = data.slice(0, 3).map((event) => {
        const parts = dateParts(event.event_date);
        return `<article class="event-row"><div class="date-box"><span>${parts.month}</span><strong>${parts.day}</strong></div><div class="event-row__body"><h3>${event.title}</h3><p>${formatDate(event.event_date)}${event.start_time ? ` | ${event.start_time}` : ""}<br>${event.location || "SDA Church Kofiase District"}</p></div><img src="${asset(event.image_url || "assets/images/event-prayer.png")}" alt=""></article>`;
      }).join("");
    }

    if (pageList) {
      pageList.innerHTML = data.map((event) => {
        const parts = dateParts(event.event_date);
        const evTitle = encodeURIComponent(event.title || "");
        const evDate = encodeURIComponent(formatDate(event.event_date));
        const contactUrl = `contact.html?eventTitle=${evTitle}&eventDate=${evDate}`;
        return `<article class="large-event"><img src="${asset(event.image_url || "assets/images/event-prayer.png")}" alt=""><div class="date-box"><span>${parts.month}</span><strong>${parts.day}</strong></div><div><h3>${event.title}</h3><p>${formatDate(event.event_date)}${event.start_time ? ` | ${event.start_time}` : ""}</p><p>${event.description || event.location || ""}</p><a href="${contactUrl}">Ask about this event</a></div></article>`;
      }).join("");
    }
  }

  function announcementPriorityRank(priority) {
    if (priority === "urgent") return 0;
    if (priority === "featured") return 1;
    return 2;
  }

  function announcementMarkup(item) {
    const link = item.link_url
      ? `<a href="${item.link_url}">${item.link_label || "Read More"}</a>`
      : "";
    return `<article class="content-card announcement-card" data-priority="${item.priority || "normal"}"><div class="announcement-meta"><span>${item.priority || "Notice"}</span><time>${formatDate(item.announcement_date)}</time></div><h3>${item.title}</h3><p>${item.summary || item.body || ""}</p>${item.ministry ? `<small>${item.ministry}</small>` : ""}${link}</article>`;
  }

  async function loadPublicAnnouncements() {
    if (!client) return;
    const homeList = document.querySelector("[data-public-announcements]");
    const pageList = document.querySelector("[data-public-announcements-list]");
    if (!homeList && !pageList) return;

    const { data, error } = await client
      .from("announcements")
      .select("title,ministry,announcement_date,summary,body,link_url,link_label,priority,status,expires_on")
      .eq("status", "published")
      .order("announcement_date", { ascending: false })
      .limit(pageList ? 30 : 6);
    if (error || !data || !data.length) return;

    const today = new Date().toISOString().slice(0, 10);
    const visible = data
      .filter((item) => !item.expires_on || item.expires_on >= today)
      .sort((a, b) => announcementPriorityRank(a.priority) - announcementPriorityRank(b.priority));

    if (homeList) homeList.innerHTML = visible.slice(0, 3).map(announcementMarkup).join("");
    if (pageList) pageList.innerHTML = visible.map(announcementMarkup).join("");
  }

  async function loadPublicSermons() {
    if (!client) return;
    const grid = document.querySelector("[data-public-sermons]");
    const featured = document.querySelector("[data-featured-sermon]");
    const homeFeature = document.querySelector("[data-home-sermon-feature]");
    const homeList = document.querySelector("[data-home-sermon-list]");
    if (!grid && !featured && !homeFeature && !homeList) return;

    const { data, error } = await client
      .from("sermons")
      .select("title,speaker,sermon_date,summary,thumbnail_url,video_url,category,duration,status")
      .eq("status", "published")
      .order("sermon_date", { ascending: false })
      .limit(12);
    if (error || !data || !data.length) return;

    if (featured) {
      const sermon = data[0];
      const embed = featured.querySelector("[data-featured-sermon-embed]");
      const title = featured.querySelector("[data-featured-sermon-title]");
      const summary = featured.querySelector("[data-featured-sermon-summary]");
      const speaker = featured.querySelector("[data-featured-sermon-speaker]");
      const date = featured.querySelector("[data-featured-sermon-date]");
      const type = featured.querySelector("[data-featured-sermon-type]");
      const link = featured.querySelector("[data-featured-sermon-link]");
      const embedUrl = youtubeEmbedUrl(sermon.video_url);

      if (embed && embedUrl) {
        embed.removeAttribute("srcdoc");
        embed.src = embedUrl;
      }
      if (title) title.textContent = sermon.title;
      if (summary) summary.textContent = sermon.summary || "Watch the latest message from SDA Church Kofiase District.";
      if (speaker) speaker.textContent = sermon.speaker || "SDA Church Kofiase District";
      if (date) date.textContent = formatDate(sermon.sermon_date);
      if (type) type.textContent = sermon.category || "Sermon";
      if (link) link.href = sermon.video_url || "live.html";
    }

    if (grid) {
      grid.innerHTML = data.map((sermon) => `<article class="content-card sermon-card" data-category="${sermonCategoryKey(sermon.category)}"><img src="${asset(sermon.thumbnail_url || "assets/images/sermon-main.png")}" alt=""><div><h3>${sermon.title}</h3><p>${sermon.speaker || ""}</p><small>${formatDate(sermon.sermon_date)}${sermon.duration ? ` &bull; ${sermon.duration}` : ""}</small><a href="${sermon.video_url || "live.html"}">Watch</a></div></article>`).join("");
    }

    if (homeFeature && data[0]) {
      const sermon = data[0];
      const image = homeFeature.querySelector("img");
      const title = homeFeature.querySelector("h3");
      const details = homeFeature.querySelectorAll("p");
      const link = homeFeature.querySelector("a");
      if (image) image.src = asset(sermon.thumbnail_url || "assets/images/sermon-main.png");
      if (title) title.textContent = sermon.title;
      if (details[0]) details[0].textContent = sermon.speaker || "SDA Church Kofiase District";
      if (details[1]) details[1].textContent = formatDate(sermon.sermon_date);
      if (link) link.href = sermon.video_url || "sermons.html";
    }

    if (homeList) {
      homeList.innerHTML = data.slice(1, 3).map((sermon) => `<a class="sermon-row" href="${sermon.video_url || "sermons.html"}"><img src="${asset(sermon.thumbnail_url || "assets/images/sermon-purpose.png")}" alt=""><span><strong>${sermon.title}</strong><small>${sermon.speaker || "SDA Church Kofiase District"} | ${formatDate(sermon.sermon_date)}</small></span><time>${sermon.duration || ""}</time></a>`).join("");
    }
  }

  async function loadPublicGallery() {
    if (!client) return;
    const grid = document.querySelector("[data-public-gallery]");
    const preview = document.querySelector("[data-public-gallery-preview]");
    if (!grid && !preview) return;

    const limit = preview && !grid ? 3 : 30;
    const { data, error } = await client
      .from("gallery_items")
      .select("title,caption,category,image_url,alt_text,taken_on,status,sort_order")
      .in("status", ["published", "featured"])
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data || !data.length) return;

    const markup = data.map((item) => `<article class="gallery-card" data-category="${item.category || "worship"}"><img src="${asset(item.image_url)}" alt="${item.alt_text || item.title}"><div><span>${item.category || "Gallery"}</span><h3>${item.title}</h3>${item.caption ? `<p>${item.caption}</p>` : ""}</div></article>`).join("");
    if (grid) grid.innerHTML = markup;
    if (preview) preview.innerHTML = data.slice(0, 3).map((item) => `<article class="gallery-card" data-category="${item.category || "worship"}"><img src="${asset(item.image_url)}" alt="${item.alt_text || item.title}"><div><span>${item.category || "Gallery"}</span><h3>${item.title}</h3></div></article>`).join("");
  }

  async function loadPublicMinistries() {
    if (!client) return;
    const cards = document.querySelectorAll("[data-ministry-card]");
    const page = document.querySelector("[data-ministry-page]");
    if (!cards.length && !page) return;

    const { data, error } = await client
      .from("ministries")
      .select("slug,name,page_url,summary,focus_title,focus_body,programs,status,sort_order")
      .eq("status", "published")
      .order("sort_order", { ascending: true });
    if (error || !data || !data.length) return;

    const bySlug = Object.fromEntries(data.map((ministry) => [ministry.slug, ministry]));
    cards.forEach((card) => {
      const ministry = bySlug[card.dataset.ministryCard];
      if (!ministry) return;
      const title = card.querySelector("h3");
      const summary = card.querySelector("p");
      const link = card.querySelector("a");
      if (title) title.textContent = ministry.name;
      if (summary) summary.textContent = ministry.summary || "";
      if (link && ministry.page_url) link.href = ministry.page_url;
    });

    if (page) {
      const ministry = bySlug[page.dataset.ministryPage];
      if (!ministry) return;
      const summary = page.querySelector("[data-ministry-summary]");
      const focusTitle = page.querySelector("[data-ministry-focus-title]");
      const focusBody = page.querySelector("[data-ministry-focus-body]");
      const programs = page.querySelector("[data-ministry-programs]");
      if (summary) summary.textContent = ministry.summary || summary.textContent;
      if (focusTitle) focusTitle.textContent = ministry.focus_title || focusTitle.textContent;
      if (focusBody) focusBody.textContent = ministry.focus_body || focusBody.textContent;
      if (programs) {
        const items = programList(ministry.programs);
        if (items.length) {
          programs.innerHTML = items.map((item) => `<article class="feature-card"><span class="feature-icon">${String(item).trim().charAt(0) || "M"}</span><h3>${item}</h3><p>${ministry.summary || ""}</p></article>`).join("");
        }
      }
    }
  }

  async function loadPublicSettings() {
    if (!client) return;
    try {
      const { data, error } = await client.from("site_settings").select("key,value").eq("key", "profile");
      if (error || !data || !data.length) return;
      const profile = data[0].value || {};
      const tiktok = profile.tiktok_url;
      if (tiktok) {
        const card = document.querySelector('.tiktok-card');
        const link = document.getElementById('tiktok-live');
        if (card) card.dataset.tiktokUrl = tiktok;
        if (link) {
          link.href = tiktok;
          link.dataset.placeholder = 'false';
          link.textContent = 'Watch on TikTok Live';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      }
      // Populate public resource links if present
      const resources = profile.resources || {};
      try {
        const setLink = (id, url, label) => {
          if (!url) return;
          const el = document.getElementById(id);
          if (el) {
            el.href = url;
            if (label) el.textContent = label;
            el.target = '_blank';
            el.rel = 'noopener noreferrer';
          }
        };
        setLink('link-adventist', resources.adventist_org, 'Adventist.org');
        setLink('link-ssnet', resources.ssnet, 'Sabbath School');
        setLink('link-youversion', resources.youversion, 'YouVersion');
        setLink('link-youth', resources.youth_gc, 'GC Youth');
        setLink('link-hope', resources.hopechannel, 'Hope Channel');
        setLink('link-children', resources.children, "Children's Ministry");
      } catch (err) {
        // ignore
      }
    } catch (err) {
      // ignore
    }
  }

  async function loadAdminSermons() {
    if (!client) return;
    const tbody = document.querySelector("[data-admin-sermons]");
    if (!tbody) return;
    const { data, error } = await client.from("sermons").select("*").order("sermon_date", { ascending: false });
    if (error || !data) return;
    tbody.innerHTML = data.map((sermon) => `<tr data-sermon-id="${sermon.id}"><td>${sermon.title}</td><td>${sermon.speaker || ""}</td><td>${formatDate(sermon.sermon_date)}</td><td>${pill(sermon.status)}</td><td><button type="button" data-edit-sermon="${sermon.id}">Edit</button> <button type="button" data-delete-sermon="${sermon.id}">Delete</button></td></tr>`).join("");

    // attach delete handlers
    tbody.querySelectorAll("[data-delete-sermon]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.deleteSermon;
        if (!id) return;
        if (!confirm("Delete this sermon? This action cannot be undone.")) return;
        const { error: delError } = await client.from("sermons").delete().eq("id", id);
        if (delError) {
          console.error(delError);
          alert("Could not delete sermon: " + (delError.message || delError.error_description || delError.code || "Unknown error"));
          return;
        }
        // refresh list
        loadAdminSermons();
      });
    });

    // attach edit handlers
    tbody.querySelectorAll("[data-edit-sermon]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.editSermon;
        if (!id) return;
        // fetch sermon details
        const { data: sermon, error } = await client.from("sermons").select("*").eq("id", id).maybeSingle();
        if (error || !sermon) {
          alert("Could not load sermon details.");
          return;
        }
        const form = document.querySelector("#sermon-form");
        if (!form) return;
        form.dataset.sermonId = sermon.id;
        form.querySelector("#sermon-title").value = sermon.title || "";
        form.querySelector("#sermon-speaker").value = sermon.speaker || "";
        form.querySelector("#sermon-date").value = sermon.sermon_date || "";
        form.querySelector("#sermon-series").value = sermon.category || "Worship";
        form.querySelector("#sermon-link").value = sermon.video_url || "";
        form.querySelector("#sermon-thumbnail").value = sermon.thumbnail_url || "";
        form.querySelector("#sermon-summary").value = sermon.summary || "";
        form.querySelector("#sermon-status").value = sermon.status || "draft";

        const submitBtn = form.querySelector("button[type=submit]");
        if (submitBtn) submitBtn.textContent = "Update Sermon";

        if (!form.querySelector("[data-cancel-edit]")) {
          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.className = "btn btn--dark";
          cancel.dataset.cancelEdit = "";
          cancel.textContent = "Cancel";
          cancel.style.marginLeft = "8px";
          cancel.addEventListener("click", () => {
            form.reset();
            delete form.dataset.sermonId;
            if (submitBtn) submitBtn.textContent = "Save Sermon";
            cancel.remove();
          });
          submitBtn.parentNode.insertBefore(cancel, submitBtn.nextSibling);
        }
        // scroll to form
        form.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  async function loadAdminEvents() {
    if (!client) return;
    const list = document.querySelector("[data-admin-events]");
    if (!list) return;
    const { data, error } = await client.from("events").select("*").order("event_date", { ascending: true });
    if (error || !data) return;
    list.innerHTML = data.map((event) => {
      const parts = dateParts(event.event_date);
      return `<article><time><span>${parts.month}</span><strong>${parts.day}</strong></time><div><h3>${event.title}</h3><p>${formatDate(event.event_date)}${event.start_time ? `, ${event.start_time}` : ""}</p></div>${pill(event.status)}</article>`;
    }).join("");
  }

  async function loadAdminGallery() {
    if (!client) return;
    const tbody = document.querySelector("[data-admin-gallery]");
    if (!tbody) return;
    const { data, error } = await client
      .from("gallery_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error || !data) return;
    tbody.innerHTML = data.map((item) => `<tr><td><img class="admin-thumb" src="${asset(item.image_url)}" alt=""></td><td>${item.title}</td><td>${item.category || ""}</td><td>${pill(item.status)}</td><td><button type="button">Edit</button></td></tr>`).join("");
  }

  async function loadAdminAnnouncements() {
    if (!client) return;
    const tbody = document.querySelector("[data-admin-announcements]");
    if (!tbody) return;
    const { data, error } = await client
      .from("announcements")
      .select("*")
      .order("announcement_date", { ascending: false })
      .limit(60);
    if (error || !data) return;
    tbody.innerHTML = data.map((item) => `<tr><td>${item.title}</td><td>${item.ministry || ""}</td><td>${formatDate(item.announcement_date)}</td><td>${item.priority || "normal"}</td><td>${pill(item.status)}</td></tr>`).join("");
  }

  async function loadAdminMinistries() {
    const tbody = document.querySelector("[data-admin-ministries]");
    const form = document.querySelector("[data-supabase-form='ministry']");
    if (!tbody && !form) return;

    if (!client) {
      if (form) fillMinistryForm(form, ministryDefaults.youth);
      return;
    }

    const { data, error } = await client
      .from("ministries")
      .select("slug,name,page_url,summary,focus_title,focus_body,programs,status,sort_order")
      .order("sort_order", { ascending: true });
    if (error || !data) return;

    const ministries = data.length ? data : Object.values(ministryDefaults);
    if (tbody) {
      tbody.innerHTML = ministries.map((ministry) => `<tr><td>${ministry.name}</td><td>${ministry.summary || ""}</td><td>${pill(ministry.status || "published")}</td><td><a href="${adminPageUrl(ministry.page_url)}">View</a></td></tr>`).join("");
    }

    if (form) {
      form._ministriesBySlug = Object.fromEntries(ministries.map((ministry) => [ministry.slug, ministry]));
      const selected = form.querySelector("#ministry-slug")?.value || "youth";
      fillMinistryForm(form, ministries.find((ministry) => ministry.slug === selected) || ministries[0]);
    }
  }

  async function loadAdminGiving() {
    if (!client) return;
    const tbody = document.querySelector("[data-admin-giving]");
    if (!tbody) return;
    const { data, error } = await client.from("giving_records").select("*").order("created_at", { ascending: false }).limit(50);
    if (error || !data) return;
    tbody.innerHTML = data.map((gift) => `<tr><td>${formatDate((gift.received_at || gift.created_at || "").slice(0, 10))}</td><td>${gift.giver_name || "Anonymous"}</td><td>${gift.fund || ""}</td><td>${money(gift.amount)}</td><td>${pill(gift.status)}</td></tr>`).join("");
  }

  async function loadAdminMessages() {
    if (!client) return;
    const list = document.querySelector("[data-admin-messages]");
    const detail = document.querySelector("[data-admin-message-detail]");
    const form = document.querySelector("[data-supabase-form='message-reply']");
    if (!list || !detail) return;

    const { data, error } = await client.from("messages").select("*").order("created_at", { ascending: false }).limit(40);
    if (error || !data) return;

    function selectMessage(message) {
      if (form) form.dataset.messageId = message.id;
      detail.innerHTML = `<p><strong>From:</strong> ${message.name || "Unknown"}</p><p><strong>Phone:</strong> ${message.phone || ""}</p><p><strong>Email:</strong> ${message.email || ""}</p><p><strong>Topic:</strong> ${message.topic || ""}</p><p>${message.message || ""}</p>`;
    }

    list.innerHTML = "";
    data.forEach((message, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === 0 ? "is-active" : "";
      button.innerHTML = `<strong>${message.name || "Unknown"}</strong><span>${message.topic || "Message"}</span><small>${formatDate((message.created_at || "").slice(0, 10))}</small>`;
      button.addEventListener("click", () => {
        list.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        selectMessage(message);
      });
      list.append(button);
    });

    if (data[0]) selectMessage(data[0]);
    // Update unread count pill in the admin header
    try {
      const unreadCount = data.filter((m) => (m.status || 'unread') === 'unread').length;
      const pill = document.querySelector('.status-pill[data-unread-count]');
      if (pill) pill.textContent = `${unreadCount} unread`;
      const statElem = document.querySelector('[data-stat="unread-messages"]');
      if (statElem) statElem.textContent = String(unreadCount);
    } catch (e) {
      console.warn('Could not update unread count', e);
    }

    // Wire up the "Mark Resolved" button in the reply form (mark as read/resolve without sending)
    try {
      if (form) {
        const markBtn = form.querySelector('.admin-form-actions button[type="button"]');
        if (markBtn) {
          markBtn.addEventListener('click', async () => {
            const messageId = form.dataset.messageId;
            if (!messageId) {
              setStatus(form, 'Choose a message first.', 'error');
              return;
            }
            setStatus(form, 'Marking message...', 'info');
            const { error: markErr } = await client
              .from('messages')
              .update({ status: 'resolved', replied_at: new Date().toISOString() })
              .eq('id', messageId);
            if (markErr) {
              setStatus(form, 'Could not mark message resolved.', 'error');
              console.error('Mark resolved error', markErr);
              return;
            }
            form.reset();
            setStatus(form, 'Message marked resolved.', 'success');
            loadAdminMessages();
          });
        }
      }
    } catch (e) {
      console.warn('Could not wire mark resolved button', e);
    }
  }

  async function loadSettings() {
    if (!client || document.body.dataset.adminPage !== "settings") return;
    const { data, error } = await client.from("site_settings").select("key,value").in("key", ["profile", "schedule"]);
    if (error || !data) return;
    const settings = Object.fromEntries(data.map((item) => [item.key, item.value]));
    if (settings.profile) {
      const profile = settings.profile;
      const set = (selector, value) => {
        const input = document.querySelector(selector);
        if (input && value) input.value = value;
      };
      set("#site-name", profile.name);
      set("#site-tagline", profile.tagline);
      set("#site-location", profile.location);
      set("#site-phone", profile.phone);
      set("#site-email", profile.email);
      set("#site-tiktok", profile.tiktok_url || "");
      const resources = profile.resources || {};
      set("#site-link-adventist", resources.adventist_org || "");
      set("#site-link-ssnet", resources.ssnet || "");
      set("#site-link-youversion", resources.youversion || "");
      set("#site-link-youth", resources.youth_gc || "");
      set("#site-link-hope", resources.hopechannel || "");
      set("#site-link-children", resources.children || "");
    }
    if (settings.schedule) {
      const schedule = settings.schedule;
      const set = (selector, value) => {
        const input = document.querySelector(selector);
        if (input && value) input.value = value;
      };
      set("#sabbath-time", schedule.sabbath);
      set("#study-time", schedule.bible_study);
      set("#prayer-time", schedule.prayer);
      set("#live-status", schedule.live_status);
    }
  }

  ready(() => {
    showSetupNotice();
    initLogin();
    guardAdmin();
    initMinistryEditor();
    initSupabaseForms();
    loadPublicEvents();
    loadPublicAnnouncements();
    loadPublicSermons();
    loadPublicGallery();
    loadPublicMinistries();
    loadAdminSermons();
    loadAdminEvents();
    loadAdminAnnouncements();
    loadAdminGallery();
    loadAdminMinistries();
    loadAdminGiving();
    loadAdminMessages();
    loadSettings();
    loadPublicSettings();
  });
})();
