# DuckDuckQuack Server

Multiplayer game server built with Colyseus for the DuckDuckQuack game.

## Features

- Real-time multiplayer game rooms
- WebSocket-based communication
- Room code system for easy joining
- Game state synchronization
- CORS-enabled for cross-platform play
- SSL/TLS support for secure connections
- Environment-based configuration
- Production-ready deployment

## Quick Start

### Prerequisites

- Node.js 20.9.0 or higher
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   
   **Option A: Quick Setup**
   ```bash
   # Run the automated setup script from project root
   ./setup-env.sh
   ```
   
   **Option B: Manual Setup**
   
   Create `.env` file:
   ```bash
   PORT=2567
   NODE_ENV=development
   ENABLE_SSL=false
   CORS_ORIGIN=*
   ```

3. **Start the server**
   ```bash
   npm start
   ```

## Environment Configuration

### Environment Variables (.env)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Server port | `2567` | `2567` |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `ENABLE_SSL` | Enable SSL/TLS | `false` | `true` |
| `SSL_CERT_PATH` | SSL certificate path | - | `/path/to/cert.pem` |
| `SSL_KEY_PATH` | SSL private key path | - | `/path/to/key.pem` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` | `https://yourdomain.com` |

### Environment Setup Examples

#### Development (No SSL)
```bash
PORT=2567
NODE_ENV=development
ENABLE_SSL=false
CORS_ORIGIN=*
```

#### Development (With SSL)
```bash
PORT=2567
NODE_ENV=development
ENABLE_SSL=true
SSL_CERT_PATH=./ssl/localhost.pem
SSL_KEY_PATH=./ssl/localhost-key.pem
CORS_ORIGIN=*
```

#### Production
```bash
PORT=2567
NODE_ENV=production
ENABLE_SSL=true
SSL_CERT_PATH=/etc/ssl/certs/yourdomain.crt
SSL_KEY_PATH=/etc/ssl/private/yourdomain.key
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

## SSL Certificate Setup

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

## API Endpoints

### Health Check
```
GET /hello_world
```
Returns server status message.

### Room Lookup
```
GET /room/:roomCode
```
Returns room information by room code.

**Response:**
```json
{
  "roomId": "room-id-here",
  "exists": true
}
```

### Development Tools
- **Playground**: `http://localhost:2567/` (development only)
- **Monitor**: `http://localhost:2567/monitor` (always available)

## Project Structure

```
duckduckquackServer/
├── src/
│   ├── rooms/
│   │   ├── MyRoom.ts           # Main game room logic
│   │   └── schema/
│   │       └── MyRoomState.ts  # Game state schema
│   ├── app.config.ts           # Server configuration with SSL/CORS
│   └── index.ts                # Entry point
├── build/                      # Compiled JavaScript (after build)
├── test/                       # Test files
├── loadtest/                   # Load testing scripts
├── .env                        # Environment variables
├── package.json                # Dependencies and scripts
└── tsconfig.json               # TypeScript configuration
```

## Scripts

- `npm start` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run clean` - Clean build directory
- `npm test` - Run test suite
- `npm run loadtest` - Run load testing

## CORS Configuration

### Development
- `CORS_ORIGIN=*` - Allows all origins (for testing)

### Production
- `CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com` - Specific domains only
- `CORS_ORIGIN=` (empty) - Disables CORS completely

## Deployment

### Docker Deployment
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 2567
CMD ["npm", "start"]
```

### Environment Variables for Production
```bash
# Required
NODE_ENV=production
ENABLE_SSL=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
CORS_ORIGIN=https://yourdomain.com

# Optional
PORT=2567
```

## Troubleshooting

### SSL Issues
- Check certificate paths are correct
- Ensure certificates are valid and not expired
- Verify file permissions on certificate files
- Check that `ENABLE_SSL=true` is set

### CORS Issues
- Check `CORS_ORIGIN` configuration
- Ensure client URL matches allowed origins
- Verify protocol (http vs https) matches
- Check that origins are comma-separated

### Connection Issues
- Ensure port 2567 is not blocked
- Check firewall settings
- Verify environment variables are correctly set
- Check server logs for errors

### Environment Issues
- Make sure `.env` file is in the server root directory
- Check that environment variables are properly formatted
- Restart server after changing environment variables
- Verify all required variables are set

## Security Notes

1. **Never commit .env files** to version control
2. **Use strong secrets** in production
3. **Restrict CORS origins** in production
4. **Use HTTPS** in production
5. **Keep SSL certificates updated**
6. **Use environment-specific configurations**
7. **Regularly update dependencies**

## Monitoring

The server includes built-in monitoring tools:

- **Colyseus Monitor**: Available at `/monitor` endpoint
- **Health Check**: Available at `/hello_world` endpoint
- **Playground**: Available at `/` in development mode

## License

MIT
