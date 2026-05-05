# Blackstone Protective Service Ltd — Website

Professional static website for [Blackstone Protective Service Ltd](https://blackstoneprotective.com) — built with vanilla HTML5, CSS3, and JavaScript (ES6+). Hosted on GitHub Pages with a custom domain.

---

## Folder Structure

```
blackstone-protective/
├── index.html              ← Home page
├── about.html              ← About Us page
├── careers.html            ← Careers page + application form
├── booking.html            ← Booking/Contact page + enquiry form
├── CNAME                   ← GitHub Pages custom domain
│
├── css/
│   └── style.css           ← Complete stylesheet (design tokens, layout, components)
│
├── js/
│   ├── cms-fetch.js        ← Fetches JSON from /data/ and binds to DOM
│   ├── main.js             ← Header scroll, mobile nav, active links
│   └── forms.js            ← 4-tier security form handler
│
├── data/                   ← CMS-generated JSON (editable via /admin)
│   ├── global.json         ← Sitewide: logo, nav, contact, footer
│   ├── home.json           ← Hero, stats, services, about preview, CTA
│   ├── about.json          ← Mission, vision, values, story, why choose
│   ├── careers.json        ← Job listings, form options, benefits
│   └── booking.json        ← Booking info panel and form options
│
├── admin/
│   ├── index.html          ← Sveltia CMS entry point
│   └── config.yml          ← CMS collection definitions (all fields, all pages)
│
├── images/
│   └── uploads/            ← Images uploaded via CMS (or placed manually)
│       ├── logo.png
│       ├── hero-bg.png
│       ├── about-operatives.png
│       ├── manned-guarding.png
│       ├── executive-protection.png
│       ├── event-security.png
│       ├── electronic-security.png
│       └── k9-unit.png
│
└── backend/
    └── blackstone.gs       ← Google Apps Script backend (email + reCAPTCHA)
```

---

## Quick Setup Checklist

### 1. GitHub Pages
1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages → Source → Deploy from branch → main → / (root)**.
3. Under **Custom domain**, enter `blackstoneprotective.com`.
4. At your domain registrar, add these DNS records:
   ```
   A     @   185.199.108.153
   A     @   185.199.109.153
   A     @   185.199.110.153
   A     @   185.199.111.153
   CNAME www blackstoneprotective.com
   ```

### 2. Sveltia CMS
1. In `admin/config.yml`, replace `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` with your actual GitHub repo.
2. Register an OAuth App at **GitHub → Settings → Developer Settings → OAuth Apps**:
   - Homepage URL: `https://blackstoneprotective.com`
   - Callback URL: `https://sveltia-cms-auth.pages.dev/callback`
3. Access the CMS at: `https://blackstoneprotective.com/admin/`

### 3. Google reCAPTCHA v2
1. Go to: https://www.google.com/recaptcha/admin
2. Register domain `blackstoneprotective.com` for **reCAPTCHA v2 ("I'm not a robot")**.
3. Copy your **Site Key** → paste into both `careers.html` and `booking.html`:
   ```html
   <div class="g-recaptcha" data-sitekey="YOUR_SITE_KEY_HERE"></div>
   ```
4. Copy your **Secret Key** → paste into `backend/blackstone.gs` `CONFIG.RECAPTCHA_SECRET`.

### 4. Google Apps Script Backend
1. Go to: https://script.google.com/
2. Create a new project, paste the contents of `backend/blackstone.gs`.
3. Edit `CONFIG.OWNER_EMAIL` (where form emails are sent).
4. Deploy: **Deploy → New Deployment → Web App → Execute as Me → Anyone**.
5. Copy the deployment URL (looks like `https://script.google.com/macros/s/AKfyc.../exec`).
6. Encode it — run this in the browser console:
   ```javascript
   btoa('YOUR_DEPLOYMENT_URL').split('').reverse().join('')
   ```
7. Paste the result as `_GAS_ENC` in `js/forms.js`.

### 5. Update Contact Details
Edit `data/global.json` to update real phone, email, and address — or use the CMS admin panel.

---

## Security Architecture — Forms

| Layer | Mechanism | Location |
|-------|-----------|----------|
| Tier 1 | **Honeypot** hidden field | `careers.html` / `booking.html` + `forms.js` |
| Tier 2 | **Time-to-submit** (< 3s = bot blocked) | `forms.js` |
| Tier 3 | **reCAPTCHA v2** checkbox | All forms |
| Tier 4 | **Obfuscated GAS URL** (Base64 + reverse) | `forms.js` `_GAS_ENC` |

---

## CMS — How Content Editing Works

1. Visit `https://blackstoneprotective.com/admin/`
2. Log in with GitHub.
3. Edit any field across Global Settings, Home, About, Careers, or Booking.
4. Click **Publish** — Sveltia CMS commits the updated JSON file to your repo.
5. GitHub Pages rebuilds automatically.
6. The website fetches the updated `/data/*.json` on next page load — **no redeploy needed**.

---

## Tech Stack

- **HTML5** — Semantic markup with full accessibility attributes
- **CSS3** — Design tokens, `clamp()` fluid typography, CSS Grid, Flexbox, micro-animations
- **JavaScript ES6+** — Vanilla, no frameworks, no build step
- **Sveltia CMS** — GitHub-backed headless CMS, JSON output
- **Google Apps Script** — Serverless form processing and email
- **GitHub Pages** — Static hosting with HTTPS and custom domain
