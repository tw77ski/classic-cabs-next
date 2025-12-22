# Classic Cabs - Linode Deployment Guide

## Prerequisites

- Linode server with Docker and Docker Compose installed
- Domain name pointing to your Linode IP (optional but recommended)
- SSH access to your server

## Environment Variables

Create a `.env` file on your server with these values:

```bash
# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db:5432/classic_cabs
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=classic_cabs
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD

# TaxiCaller API
TC_API_KEY=your_taxicaller_api_key
TC_API_SECRET=your_taxicaller_api_secret
TC_COMPANY_ID=your_company_id
TC_DOMAIN=api.taxicaller.net

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token

# Optional: Sentry
SENTRY_DSN=
```

## Deployment Steps

### 1. SSH into your Linode server

```bash
ssh root@your-linode-ip
```

### 2. Clone or pull the repository

```bash
# First time
git clone https://github.com/tw77ski/classic-cabs-next.git
cd classic-cabs-next

# Or update existing
cd classic-cabs-next
git pull origin main
```

### 3. Create environment file

```bash
nano .env
# Paste your environment variables and save
```

### 4. Build and start containers

```bash
# Build and start in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Check status
docker-compose ps
```

### 5. Initialize the database (first time only)

The database schema is automatically applied on first start via the init script.

To add corporate users:

```bash
# Enter the app container
docker-compose exec app sh

# Or run the setup script manually
docker-compose exec app npx tsx scripts/setup-corporate-users.ts
```

## Useful Commands

```bash
# View all logs
docker-compose logs -f

# View app logs only
docker-compose logs -f app

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database)
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build

# Check container health
docker-compose ps

# Enter app container
docker-compose exec app sh

# Enter database container
docker-compose exec db psql -U postgres -d classic_cabs
```

## SSL/HTTPS Setup (Recommended)

### Option 1: Nginx Proxy Manager (Easiest)

1. Deploy Nginx Proxy Manager as a separate container
2. Point your domain to the Linode IP
3. Add a proxy host for port 3000
4. Enable SSL with Let's Encrypt

### Option 2: Caddy (Simple)

Create `Caddyfile`:

```
yourdomain.com {
    reverse_proxy app:3000
}
```

### Option 3: Traefik (Advanced)

See Traefik documentation for Docker labels configuration.

## Health Checks

The app includes a health endpoint:

```bash
curl http://localhost:3000/api/taxicaller-health
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs app

# Check if port 3000 is in use
lsof -i :3000
```

### Database connection issues

```bash
# Check if database is healthy
docker-compose exec db pg_isready

# Check database logs
docker-compose logs db
```

### Memory issues

Add memory limits to `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512M
```

## Updating the Application

```bash
cd classic-cabs-next
git pull origin main
docker-compose up -d --build
```

## Backup Database

```bash
# Create backup
docker-compose exec db pg_dump -U postgres classic_cabs > backup_$(date +%Y%m%d).sql

# Restore backup
docker-compose exec -T db psql -U postgres classic_cabs < backup_20241222.sql
```

