# My Website

A simple personal landing page built with plain HTML, CSS, and JavaScript. No build step required.

## Customize

1. Open `index.html` and replace **Your Name**, bio text, project cards, email, and social links.
2. Tweak colors in `styles.css` (`:root` variables at the top).

## Preview locally

```bash
cd my-website
python3 -m http.server 8080
```

Then open http://localhost:8080 in your browser.

## Deploy for free

### GitHub Pages (recommended)

1. Create a repo on GitHub and push this folder.
2. In the repo: **Settings → Pages → Build and deployment → Source**: Deploy from branch `main`, folder `/ (root)`.
3. Your site will be live at `https://<username>.github.io/<repo-name>/`.

### Netlify

1. Sign up at [netlify.com](https://www.netlify.com).
2. Drag and drop this folder onto the Netlify dashboard, or connect your GitHub repo.
3. No build command needed — publish directory is the repo root.

### Vercel

1. Sign up at [vercel.com](https://vercel.com).
2. Import the GitHub repo with framework preset **Other** (static files only).

All three options offer free hosting for personal sites.
