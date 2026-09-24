#!/bin/bash
set -e

BUCKET="balloi-immobiliare-backup-576134963750"
APP_DIR="/home/ec2-user/balloi-immobiliare"

dnf update -y
dnf install -y docker unzip
systemctl enable --now docker
usermod -aG docker ec2-user

mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install

mkdir -p "$APP_DIR/db"
cd "$APP_DIR"

cat > docker-compose.yml << 'COMPOSE'
services:
  db:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:?imposta DB_ROOT_PASSWORD nel file .env}
      MYSQL_DATABASE: ${DB_NAME:-omi}
      MYSQL_USER: ${DB_USER:-balloi}
      MYSQL_PASSWORD: ${DB_PASSWORD:?imposta DB_PASSWORD nel file .env}
    volumes:
      - db_data:/var/lib/mysql
      - ./db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p\"$$MYSQL_ROOT_PASSWORD\" --silent"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

  backend:
    image: ghcr.io/danielballoi/balloi-immobiliare-backend:v0.1.0
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: development
      PORT: "5000"
      DB_HOST: db
      DB_PORT: "3306"
      DB_NAME: ${DB_NAME:-omi}
      DB_USER: ${DB_USER:-balloi}
      DB_PASSWORD: ${DB_PASSWORD:?imposta DB_PASSWORD nel file .env}
      JWT_SECRET: ${JWT_SECRET:?imposta JWT_SECRET nel file .env}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-7d}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:8080}
      COOKIE_SAMESITE: ${COOKIE_SAMESITE:-lax}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_NOME: ${ADMIN_NOME:-Admin}

  frontend:
    image: ghcr.io/danielballoi/balloi-immobiliare-frontend:v0.1.0
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "${WEB_PORT:-8080}:80"

volumes:
  db_data:
COMPOSE

cat > backup.sh << 'BACKUP'
#!/bin/bash
set -e
cd /home/ec2-user/balloi-immobiliare
docker compose exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" omi' > /tmp/backup_latest.sql
aws s3 cp /tmp/backup_latest.sql s3://balloi-immobiliare-backup-576134963750/dumps/latest.sql
echo "Backup caricato su S3."
BACKUP
chmod +x backup.sh

aws s3 cp "s3://$BUCKET/schema.sql" ./db/schema.sql || true
aws s3 cp "s3://$BUCKET/env/.env" ./.env || true

chown -R ec2-user:ec2-user "$APP_DIR"

if [ -f ./.env ] && [ -f ./db/schema.sql ]; then
  docker compose up -d

  for i in $(seq 1 30); do
    if docker compose ps db | grep -q "healthy"; then
      break
    fi
    sleep 5
  done

  if aws s3 cp "s3://$BUCKET/dumps/latest.sql" /tmp/dump_iniziale.sql; then
    docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" omi' < /tmp/dump_iniziale.sql
    echo "Dati importati da S3."
  else
    echo "Nessun backup precedente trovato, database parte vuoto."
  fi
fi
