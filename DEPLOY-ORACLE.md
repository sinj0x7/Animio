# Deploy on Oracle Cloud (Always Free)

This app is a single Docker image: Express serves the Vite `dist/` folder and API routes on `PORT` (default **3000** in the container).

## 1. Create a compute instance

1. In [Oracle Cloud](https://www.oracle.com/cloud/free/), open the **Console** → **Compute** → **Instances** → **Create instance**.
2. **Image**: Ubuntu 22.04 or 24.04.
3. **Shape** (Always Free eligible):
   - **ARM**: `VM.Standard.A1.Flex` (1 OCPU, 6 GB RAM is common on free tier), or  
   - **AMD**: `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM).
4. **Networking**: Use a **public subnet** and assign a **public IPv4** address so you can reach the app from the internet.
5. **SSH keys**: Add your public key so you can SSH as `ubuntu` (or `opc` on some images—check the instance detail page).

## 2. Open the app port in OCI

The VM’s **subnet security list** (or **Network Security Group**) must allow inbound traffic to the port you expose (e.g. **3000**).

1. **Networking** → **Virtual Cloud Networks** → your VCN → **Security Lists** (or NSGs attached to the instance).
2. Add an **ingress** rule, e.g.:
   - **Source**: `0.0.0.0/0` (whole internet) or your home IP only (more secure).
   - **IP protocol**: TCP  
   - **Destination port**: `3000` (or `80`/`443` if you put a reverse proxy in front).

Without this rule, the instance firewall can be correct and you will still get timeouts from outside.

## 3. SSH into the instance

```bash
ssh ubuntu@YOUR_PUBLIC_IP
```

(Use `opc@` if your image uses the `opc` user.)

## 4. Install Docker (Engine + Compose plugin)

On Ubuntu, follow Docker’s official [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) (add Docker’s `apt` repo, then `docker-ce` and `docker-compose-plugin`).

Then add your user to the `docker` group and log out and back in:

```bash
sudo usermod -aG docker $USER
```

## 5. Get the code and run

```bash
git clone https://github.com/YOUR_USER/YOUR_REPO.git animio
cd animio
docker compose up -d --build
```

The app listens on **port 3000** inside the container; Compose maps it to **3000** on the host by default.

- Custom host port: `HOST_PORT=8080 docker compose up -d --build`

## 6. Optional: UFW on the VM

If **UFW** is enabled:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp
sudo ufw status
```

## 7. Environment variables

For optional settings (extra HLS hosts, request logging), copy `.env.example` to `.env` on the server, edit it, and uncomment `env_file: - .env` in `docker-compose.yml`, then:

```bash
docker compose up -d --build
```

## 8. HTTPS and a domain (recommended for production)

Oracle’s free VM is just a Linux box: point your DNS **A record** to the instance’s public IP, then either:

- Put **Caddy** or **nginx** on the host listening on **80/443** and reverse-proxy to `127.0.0.1:3000`, with Let’s Encrypt, or  
- Use a separate tunnel/proxy (e.g. Cloudflare) in front of the origin.

## 9. GitHub Pages frontend + this API (your setup)

Your site at `https://sinj0x7.github.io/Animio/` is **HTTPS**. Browsers **block** calling `http://YOUR_IP:3000` from that page (mixed content). So the API must be reachable at **`https://…`** too.

### A. Oracle VM + Docker (API process)

1. Do sections **1–5** above (VM, open port **3000**, Docker, `git clone`, `cd animio`).
2. In the `animio` folder on the VM, create a file named **`.env`** (same folder as `docker-compose.yml`):

   ```env
   CORS_ORIGINS=https://sinj0x7.github.io
   ```

3. Start the stack:

   ```bash
   docker compose up -d --build
   ```

4. Test from your laptop (not a browser tab on github.io yet):

   ```bash
   curl -sS "http://YOUR_PUBLIC_IP:3000/api/top-airing" | head
   ```

   If you get JSON, the API is up.

### B. Free HTTPS URL without buying a domain (DuckDNS + Caddy)

1. Sign up at [DuckDNS](https://www.duckdns.org/), create a subdomain, set its **A record** to your VM’s **public IP**.
2. On the VM, open inbound **TCP 80** and **443** in the Oracle security list (same place as port 3000).
3. Install [Caddy](https://caddyserver.com/docs/install#debian-ubuntu-raspbian) on the VM (not inside Docker is simplest).
4. Create `/etc/caddy/Caddyfile`:

   ```caddyfile
   YOURNAME.duckdns.org {
     reverse_proxy 127.0.0.1:3000
   }
   ```

   Replace `YOURNAME` with your DuckDNS name.

5. `sudo systemctl reload caddy` (or restart Caddy). Wait until `https://YOURNAME.duckdns.org/api/top-airing` works in the browser.

Your API base for the next step is:

`https://YOURNAME.duckdns.org/api`  
(no trailing slash after `api`)

### C. Rebuild GitHub Pages with that API URL

On **your computer** (where you build the site):

```bash
cd /path/to/animio
git pull
VITE_BASE_PATH=/Animio/ VITE_API_URL=https://YOURNAME.duckdns.org/api npm run build
npx gh-pages -d dist
```

After a minute, reload `https://sinj0x7.github.io/Animio/` — **Top Airing** and **Watch** should talk to DuckDNS over HTTPS.

*(If you already own a domain, skip DuckDNS and point DNS at the VM; use Caddy the same way with your real hostname.)*

### D. Fedora 43 on your laptop (build + publish)

The Oracle VM steps above still use **Ubuntu** in the cloud. On **Fedora 43** you usually only **build** the static site and run `gh-pages` from your home machine.

**Node.js** (this project expects **Node ≥ 20**; you already use v22):

```bash
sudo dnf install nodejs npm
```

If Fedora’s packages are older than you need, use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) and install Node 22, then:

```bash
cd ~/Desktop/website
git pull
VITE_BASE_PATH=/Animio/ VITE_API_URL=https://YOURNAME.duckdns.org/api npm run build
npx gh-pages -d dist
```

**Docker on Fedora** (optional, to test the API locally): follow Docker’s [Install on Fedora](https://docs.docker.com/engine/install/fedora/) (`docker-ce`), then enable and start `docker`:

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# log out and back in
```

**Caddy on Fedora** (only if you self-host the API on this machine instead of Oracle):

```bash
sudo dnf install caddy
# edit /etc/caddy/Caddyfile, then:
sudo systemctl enable --now caddy
```

## Expectations

- **Always Free** shapes and quotas are subject to Oracle’s current terms and availability in your region.
- Free VMs are small; heavy traffic may need a paid shape or caching in front.
