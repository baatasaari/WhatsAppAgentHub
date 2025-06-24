# AgentFlow Deployment Guide

This guide covers deployment options and best practices for AgentFlow in production environments.

## Quick Start Deployment

### Replit Deployment (Recommended for Demo/Testing)

AgentFlow is pre-configured for Replit deployment:

1. **Environment Setup**
   - Ensure all required environment variables are set in Replit Secrets
   - DATABASE_URL is automatically provided by Replit Database
   - Add your OpenAI API key and other service keys

2. **Deploy**
   - Click the "Deploy" button in your Replit project
   - Replit Deployments will handle the build and hosting automatically
   - Your app will be available at `https://your-repl-name.replit.app`

3. **Custom Domain (Optional)**
   - Configure a custom domain in Replit Deployments
   - Set up DNS records as instructed

## Production Deployment Options

### 1. Docker Deployment

#### Dockerfile
```dockerfile
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S agentflow -u 1001

# Change ownership of the app directory
RUN chown -R agentflow:nodejs /app
USER agentflow

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  agentflow:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/agentflow
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
    depends_on:
      - db
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=agentflow
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - agentflow
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 2. Cloud Platform Deployments

#### AWS Deployment

**Using AWS ECS with Fargate:**

1. **Build and Push Docker Image**
```bash
# Build image
docker build -t agentflow:latest .

# Tag for ECR
docker tag agentflow:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/agentflow:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/agentflow:latest
```

2. **ECS Task Definition**
```json
{
  "family": "agentflow",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "agentflow",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/agentflow:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:agentflow/database-url"
        },
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:agentflow/openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/agentflow",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Google Cloud Platform

**Using Cloud Run:**

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/agentflow
gcloud run deploy agentflow \
  --image gcr.io/PROJECT_ID/agentflow \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 5000 \
  --memory 2Gi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=database-url:latest,OPENAI_API_KEY=openai-key:latest
```

#### Microsoft Azure

**Using Container Instances:**

```bash
# Create resource group
az group create --name agentflow-rg --location eastus

# Deploy container
az container create \
  --resource-group agentflow-rg \
  --name agentflow \
  --image your-registry.azurecr.io/agentflow:latest \
  --dns-name-label agentflow-app \
  --ports 5000 \
  --environment-variables NODE_ENV=production \
  --secure-environment-variables \
    DATABASE_URL=$DATABASE_URL \
    OPENAI_API_KEY=$OPENAI_API_KEY
```

### 3. Kubernetes Deployment

#### Deployment Configuration
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentflow
  labels:
    app: agentflow
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agentflow
  template:
    metadata:
      labels:
        app: agentflow
    spec:
      containers:
      - name: agentflow
        image: agentflow:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: agentflow-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health/live
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: agentflow-service
spec:
  selector:
    app: agentflow
  ports:
  - protocol: TCP
    port: 80
    targetPort: 5000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agentflow-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - agentflow.yourdomain.com
    secretName: agentflow-tls
  rules:
  - host: agentflow.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: agentflow-service
            port:
              number: 80
```

## Environment Configuration

### Production Environment Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://user:password@host:port/database
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Session Management
SESSION_SECRET=your-super-secure-session-secret-here
SESSION_TIMEOUT=86400000

# AI Services
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key

# Platform APIs
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
WHATSAPP_VERIFY_TOKEN=your-whatsapp-verify-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id

TELEGRAM_BOT_TOKEN=your-telegram-bot-token
DISCORD_BOT_TOKEN=your-discord-bot-token
FACEBOOK_PAGE_ACCESS_TOKEN=your-facebook-token
INSTAGRAM_ACCESS_TOKEN=your-instagram-token

# External Integrations
SALESFORCE_API_KEY=your-salesforce-key
HUBSPOT_API_KEY=your-hubspot-key
ZENDESK_API_KEY=your-zendesk-key
GOOGLE_SHEETS_API_KEY=your-google-sheets-key

# Security
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
HEALTH_CHECK_TIMEOUT=5000
```

### Database Setup

#### PostgreSQL Configuration

```sql
-- Create database
CREATE DATABASE agentflow;
CREATE USER agentflow_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE agentflow TO agentflow_user;

-- Connect to database
\c agentflow;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- For embeddings (if using pgvector)

-- Set up connection pooling (recommended)
-- Use PgBouncer or similar connection pooler
```

#### Migration and Schema Setup

```bash
# Run database migrations
npm run db:push

# Create initial admin user (optional)
npm run init:admin

# Verify database setup
npm run db:status
```

## Security Configuration

### SSL/TLS Setup

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/yourdomain.com.crt;
    ssl_certificate_key /etc/nginx/ssl/yourdomain.com.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy configuration
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Firewall Configuration

```bash
# UFW (Ubuntu)
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Only allow database access from application server
ufw allow from <app-server-ip> to any port 5432
```

## Monitoring and Logging

### Application Monitoring

#### Health Checks
```bash
# Basic health check
curl -f http://localhost:5000/api/health

# Detailed health check
curl http://localhost:5000/api/health/ready

# Metrics endpoint
curl http://localhost:5000/api/metrics
```

#### Log Configuration
```javascript
// Production logging configuration
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});
```

### External Monitoring

#### Prometheus Metrics
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'agentflow'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s
```

#### Grafana Dashboard
Import the AgentFlow dashboard configuration for monitoring:
- Request rates and response times
- Error rates and status codes
- Database connection health
- Memory and CPU usage
- AI API usage and costs

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="agentflow"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_DIR/agentflow_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/agentflow_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -name "agentflow_*.sql.gz" -mtime +30 -delete

# Upload to cloud storage (optional)
aws s3 cp $BACKUP_DIR/agentflow_$DATE.sql.gz s3://your-backup-bucket/
```

### Automated Backup with Cron

```bash
# Add to crontab
0 2 * * * /path/to/backup.sh
```

## Performance Optimization

### Application Performance

1. **Enable Caching**
   - Implement Redis for session storage
   - Cache frequently accessed data
   - Use CDN for static assets

2. **Database Optimization**
   - Configure connection pooling
   - Add appropriate indexes
   - Regular VACUUM and ANALYZE

3. **Load Balancing**
   - Use multiple application instances
   - Implement sticky sessions for WebSocket connections
   - Configure health checks

### Scaling Considerations

#### Horizontal Scaling
```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agentflow-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agentflow
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database connectivity
   psql $DATABASE_URL -c "SELECT 1;"
   
   # Check connection pool status
   curl http://localhost:5000/api/health
   ```

2. **Memory Issues**
   ```bash
   # Monitor memory usage
   free -h
   ps aux --sort=-%mem | head
   
   # Check Node.js heap usage
   curl http://localhost:5000/api/metrics | grep heap
   ```

3. **High CPU Usage**
   ```bash
   # Check CPU usage
   top -p $(pgrep node)
   
   # Profile application
   npm run profile
   ```

### Log Analysis

```bash
# View recent errors
tail -f logs/error.log

# Search for specific errors
grep "ERROR" logs/combined.log | tail -20

# Monitor request rates
grep "GET\|POST\|PUT\|DELETE" logs/access.log | awk '{print $4}' | sort | uniq -c
```

## Maintenance

### Regular Maintenance Tasks

1. **Daily**
   - Monitor application health
   - Check error logs
   - Verify backup completion

2. **Weekly**
   - Update dependencies (security patches)
   - Review performance metrics
   - Clean up old logs

3. **Monthly**
   - Database maintenance (VACUUM, REINDEX)
   - Security audit
   - Capacity planning review

### Update Procedure

```bash
# 1. Backup current deployment
./scripts/backup.sh

# 2. Deploy new version
git pull origin main
npm ci --only=production
npm run build

# 3. Run migrations (if needed)
npm run db:migrate

# 4. Restart application
pm2 restart agentflow

# 5. Verify deployment
curl -f http://localhost:5000/api/health
```

This deployment guide provides comprehensive instructions for deploying AgentFlow in various environments. Choose the deployment method that best fits your infrastructure and requirements.