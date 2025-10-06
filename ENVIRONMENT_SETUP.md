# DuckDuckQuack Environment Configuration Guide

## 🔧 Environment Variables

### Client (.env.local in duckduckquack/)
```bash
# Server Host (without protocol)
VITE_SERVER_HOST=localhost

# Server Port
VITE_SERVER_PORT=2567

# Enable SSL/TLS (true for production, false for local development)
VITE_ENABLE_SSL=false

# SSL Certificate paths (for local HTTPS development)
VITE_SSL_KEY_PATH=./ssl/localhost-key.pem
VITE_SSL_CERT_PATH=./ssl/localhost.pem

# Environment
VITE_NODE_ENV=development
```

### Server (.env in duckduckquackServer/)
```bash
# Server Port
PORT=2567

# Environment (development, staging, production)
NODE_ENV=development

# Enable SSL/TLS
ENABLE_SSL=false

# SSL Certificate paths (for production)
SSL_CERT_PATH=/path/to/certificate.crt
SSL_KEY_PATH=/path/to/private.key

# CORS Configuration (comma-separated for multiple origins)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Additional secrets (if needed for future features)
# JWT_SECRET=your-secret-key-here
```

## 🚀 Deployment Scenarios

### 1. Local Development (No SSL)
**Client (.env.local):**
```bash
VITE_SERVER_HOST=localhost
VITE_SERVER_PORT=2567
VITE_ENABLE_SSL=false
```

**Server (.env):**
```bash
PORT=2567
NODE_ENV=development
ENABLE_SSL=false
CORS_ORIGIN=*
```

### 2. Local Development with SSL
**Client (.env.local):**
```bash
VITE_SERVER_HOST=localhost
VITE_SERVER_PORT=2567
VITE_ENABLE_SSL=true
VITE_SSL_KEY_PATH=./ssl/localhost-key.pem
VITE_SSL_CERT_PATH=./ssl/localhost.pem
```

**Server (.env):**
```bash
PORT=2567
NODE_ENV=development
ENABLE_SSL=true
SSL_CERT_PATH=./ssl/localhost.pem
SSL_KEY_PATH=./ssl/localhost-key.pem
```

### 3. Production Deployment
**Client (.env.local):**
```bash
VITE_SERVER_HOST=yourdomain.com
VITE_SERVER_PORT=2567
VITE_ENABLE_SSL=true
```

**Server (.env):**
```bash
PORT=2567
NODE_ENV=production
ENABLE_SSL=true
SSL_CERT_PATH=/etc/ssl/certs/yourdomain.crt
SSL_KEY_PATH=/etc/ssl/private/yourdomain.key
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

## 🔒 SSL Certificate Setup

### For Local Development
```bash
# Install mkcert for local SSL certificates
npm install -g mkcert

# Create local CA
mkcert -install

# Generate certificates for localhost
mkcert localhost 127.0.0.1 ::1

# Move certificates to ssl folder
mkdir ssl
mv localhost+2.pem ssl/localhost.pem
mv localhost+2-key.pem ssl/localhost-key.pem
```

### For Production
Use Let's Encrypt or your SSL provider:
```bash
# Example with Let's Encrypt
certbot certonly --standalone -d yourdomain.com

# Certificates will be in:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

## 🌐 CORS Configuration

### Development
- `CORS_ORIGIN=*` - Allows all origins (for testing)

### Production
- `CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com` - Specific domains only
- `CORS_ORIGIN=` (empty) - Disables CORS completely

## 🔧 Quick Setup Commands

### 1. Development Setup
```bash
# Client
cd duckduckquack
echo "VITE_SERVER_URL=localhost:2567" > .env.local
echo "VITE_ENABLE_SSL=false" >> .env.local

# Server
cd ../duckduckquackServer
echo "PORT=2567" > .env
echo "NODE_ENV=development" >> .env
echo "ENABLE_SSL=false" >> .env
echo "CORS_ORIGIN=*" >> .env
```

### 2. Production Setup
```bash
# Client
cd duckduckquack
echo "VITE_SERVER_URL=yourdomain.com:2567" > .env.local
echo "VITE_ENABLE_SSL=true" >> .env.local

# Server
cd ../duckduckquackServer
echo "PORT=2567" > .env
echo "NODE_ENV=production" >> .env
echo "ENABLE_SSL=true" >> .env
echo "CORS_ORIGIN=https://yourdomain.com" >> .env
echo "SSL_CERT_PATH=/path/to/cert.pem" >> .env
echo "SSL_KEY_PATH=/path/to/key.pem" >> .env
```

## 🚨 Security Notes

1. **Never commit .env files** to version control
2. **Use strong JWT secrets** in production
3. **Restrict CORS origins** in production
4. **Use HTTPS** in production
5. **Keep SSL certificates updated**
6. **Use environment-specific configurations**

## 🔍 Troubleshooting

### SSL Issues
- Check certificate paths are correct
- Ensure certificates are valid and not expired
- Verify file permissions on certificate files

### CORS Issues
- Check CORS_ORIGIN configuration
- Ensure client URL matches allowed origins
- Verify protocol (http vs https) matches

### Connection Issues
- Verify VITE_SERVER_URL matches server address
- Check firewall settings
- Ensure ports are not blocked
