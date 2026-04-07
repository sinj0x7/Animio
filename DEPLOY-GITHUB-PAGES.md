# GitHub Pages + custom domain

## What I can and cannot do

- **I cannot deploy to your GitHub account** or buy DNS for you. You push this repo to GitHub, enable Pages, and (optionally) buy a domain from a registrar.
- **GitHub Pages only serves static files.** Your Express server (`/api`, HLS proxy) does **not** run on Pages. For search/streaming you must run the API elsewhere (e.g. [Oracle VM + Docker](./DEPLOY-ORACLE.md)) and point the frontend at it with **`VITE_API_URL`** (must be **`https://`** so browsers do not block mixed content).

## 1. Push the repo to GitHub

Create a repository and push this project (e.g. `main` branch).

## 2. Enable GitHub Pages (Actions)

1. Repo **Settings** → **Pages**.
2. **Build and deployment** → **Source**: **GitHub Actions** (not “Deploy from a branch” if you use the workflow in `.github/workflows/deploy-github-pages.yml`).

The included workflow builds with Vite and publishes the `dist/` folder.

## 3. Repository secret: API URL (for full app behavior)

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Name            | Example value                          |
|-----------------|----------------------------------------|
| `VITE_API_URL`  | `https://api.yourdomain.com/api`       |

Use the **public** base URL of your Node server, including `/api`, **no trailing slash** after `api` (the client appends paths like `/search/foo`).

If you omit this secret, the site still loads and **AniList** parts may work, but **AnimeKai / proxy / watch** calls will fail because they target `/api` on `github.io`, where there is no server.

### CORS on your API server

The Express app only allows cross-origin requests in production from origins you list. On the machine running Docker/Node, set:

`CORS_ORIGINS=https://sinj0x7.github.io`

(no path — the browser `Origin` header is just scheme + host). Use a comma-separated list if you have more than one site. Without this, the browser blocks API calls from GitHub Pages even when `VITE_API_URL` is correct.

## 4. Base path (usually automatic)

The workflow sets `VITE_BASE_PATH` to:

- **`/`** if the repo name is **`YOUR_USERNAME.github.io`** (user site), or
- **`/REPO_NAME/`** for a normal project repo.

If you use a **custom domain** on a **project** repo, GitHub serves the site at the **root** of that domain → set a **repository variable** (same Actions settings → **Variables**):

| Name              | Value |
|-------------------|-------|
| `VITE_BASE_PATH`  | `/`   |

Then re-run the workflow (**Actions** → workflow → **Run workflow**) so assets load from `/assets/...` instead of `/repo/assets/...`.

## 5. Custom domain (you register it)

GitHub cannot sell you a domain. Use any registrar (e.g. [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/), [Porkbun](https://porkbun.com), [Namecheap](https://www.namecheap.com)).

### After you own `example.com`

1. Repo **Settings** → **Pages** → **Custom domain** → enter e.g. `www.example.com` or `example.com`.
2. Follow GitHub’s DNS instructions. Typical setup:
   - **Apex** (`example.com`): **A** records to GitHub’s IPs (shown in GitHub docs; often `185.199.108.153`–`185.199.111.153`).
   - **www**: **CNAME** to **`YOUR_USERNAME.github.io`**.
3. Wait for DNS (minutes to hours), enable **Enforce HTTPS** when GitHub offers it.
4. Set **`VITE_BASE_PATH`** to **`/`** if this is a project repo (see above) and redeploy.

Your **API** should live on a **subdomain** with TLS, e.g. `https://api.example.com`, proxied to your VM or tunnel—separate from Pages.

## 6. Free URL without buying a domain

- **Project repo:** `https://YOUR_USERNAME.github.io/REPO_NAME/`
- **User site repo** named `YOUR_USERNAME.github.io`: `https://YOUR_USERNAME.github.io/`

No purchase required; the workflow already picks the correct `VITE_BASE_PATH` for these cases.

## 7. First deploy

Push to `main` (or `master`), or open **Actions** → **Deploy to GitHub Pages** → **Run workflow**.

If **Pages** shows “Environment” approval the first time, approve the **`github-pages`** environment deployment in the Actions run.
