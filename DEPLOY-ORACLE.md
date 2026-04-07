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

## Expectations

- **Always Free** shapes and quotas are subject to Oracle’s current terms and availability in your region.
- Free VMs are small; heavy traffic may need a paid shape or caching in front.
