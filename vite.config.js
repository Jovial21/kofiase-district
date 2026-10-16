import fs from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const pages = {
  main: "index.html",
  announcements: "announcements.html",
  about: "about.html",
    ministries: "ministries.html",
    music: "music.html",
    "personal-ministries": "personal-ministries.html",
    resources: "resources.html",
  sermons: "sermons.html",
    "sabbath-school": "sabbath-school.html",
  events: "events.html",
  gallery: "gallery.html",
  give: "give.html",
  contact: "contact.html",
  live: "live.html",
  youth: "youth.html",
  women: "women.html",
  children: "children.html",
  health: "health.html",
  "admin-announcements": "admin/announcements.html",
  "admin-dashboard": "admin/dashboard.html",
  "admin-events": "admin/events.html",
  "admin-gallery": "admin/gallery.html",
  "admin-login": "admin/login.html",
  "admin-messages": "admin/messages.html",
  "admin-ministries": "admin/ministries.html",
  "admin-sermons": "admin/sermons.html",
  "admin-settings": "admin/settings.html"
};

// Serve the project root during development so top-level HTML files
// (e.g. index.html) are available at `/` without requiring a `public/` folder.
const rootDir = resolve(process.cwd());

export default defineConfig({
  // serve the `public/` folder as the dev server root so the index inside it
  // becomes available at `/` during development
  root: rootDir,
  server: {
    host: true,
    port: 5173,
    strictPort: true
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([name, page]) => {
          const publicCandidate = resolve(rootDir, page);
          const projectCandidate = resolve(process.cwd(), page);
          const chosen = fs.existsSync(publicCandidate) ? publicCandidate : projectCandidate;
          return [name, chosen];
        })
      )
    }
  }
});
