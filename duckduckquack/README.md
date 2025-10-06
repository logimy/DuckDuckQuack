# DuckDuckQuack - Multiplayer Duck Hunting Game

A real-time multiplayer duck hunting game built with React, TypeScript, Phaser.js, and Colyseus.

## Features

- **Real-time Multiplayer**: Join rooms with friends using room codes
- **Duck Hunting Gameplay**: Hunt ducks in a shared game world
- **Cross-Platform**: Works on desktop and mobile browsers
- **Room-based Gaming**: Create or join rooms with unique codes
- **Real-time Synchronization**: Smooth player movement and game state updates
- **SSL/TLS Support**: Secure connections for production deployments
- **Environment Configuration**: Flexible setup for development and production

## Quick Start

### Prerequisites

- Node.js 20.9.0 or higher
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DuckDuckQuack
   ```

2. **Install dependencies**
   ```bash
   # Install client dependencies
   cd duckduckquack
   npm install
   
   # Install server dependencies
   cd ../duckduckquackServer
   npm install
   ```

3. **Set up environment variables**
   
   **Option A: Quick Setup (Development)**
   ```bash
   # Run the automated setup script
   ./setup-env.sh
   ```
   
   **Option B: Manual Setup**
   
   Create `duckduckquack/.env.local`:
   ```bash
   VITE_SERVER_HOST=localhost
   VITE_SERVER_PORT=2567
   VITE_ENABLE_SSL=false
   VITE_NODE_ENV=development
   ```
   
   Create `duckduckquackServer/.env`:
   ```bash
   PORT=2567
   NODE_ENV=development
   ENABLE_SSL=false
   CORS_ORIGIN=*
   ```

4. **Start the server**
   ```bash
   cd duckduckquackServer
   npm start
   ```
   The server will start on `http://localhost:2567`

5. **Start the client**
   ```bash
   cd duckduckquack
   npm run dev
   ```
   The client will start on `http://localhost:5173`

## Environment Configuration

### Client Environment Variables (.env.local)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_SERVER_HOST` | Server hostname | `localhost` | `yourdomain.com` |
| `VITE_SERVER_PORT` | Server port | `2567` | `2567` |
| `VITE_ENABLE_SSL` | Enable SSL/TLS connections | `false` | `true` |
| `VITE_SSL_KEY_PATH` | Path to SSL private key | - | `./ssl/localhost-key.pem` |
| `VITE_SSL_CERT_PATH` | Path to SSL certificate | - | `./ssl/localhost.pem` |
| `VITE_NODE_ENV` | Environment mode | `development` | `production` |

### Server Environment Variables (.env)

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
# Client (.env.local)
VITE_SERVER_HOST=localhost
VITE_SERVER_PORT=2567
VITE_ENABLE_SSL=false

# Server (.env)
PORT=2567
NODE_ENV=development
ENABLE_SSL=false
CORS_ORIGIN=*
```

#### Development (With SSL)
```bash
# Client (.env.local)
VITE_SERVER_HOST=localhost
VITE_SERVER_PORT=2567
VITE_ENABLE_SSL=true
VITE_SSL_KEY_PATH=./ssl/localhost-key.pem
VITE_SSL_CERT_PATH=./ssl/localhost.pem

# Server (.env)
PORT=2567
NODE_ENV=development
ENABLE_SSL=true
SSL_CERT_PATH=./ssl/localhost.pem
SSL_KEY_PATH=./ssl/localhost-key.pem
CORS_ORIGIN=*
```

#### Production
```bash
# Client (.env.local)
VITE_SERVER_HOST=yourdomain.com
VITE_SERVER_PORT=2567
VITE_ENABLE_SSL=true

# Server (.env)
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

## Multiplayer Setup

### For Local Network Play

To allow others on your local network to join your game:

1. **Find your computer's IP address**
   - Windows: Run `ipconfig` in Command Prompt
   - Mac/Linux: Run `ifconfig` in Terminal

2. **Configure the client for remote access**
   Update `duckduckquack/.env.local`:
   ```bash
   VITE_SERVER_HOST=YOUR_IP_ADDRESS
   VITE_SERVER_PORT=2567
   ```
   Replace `YOUR_IP_ADDRESS` with your actual IP address (e.g., `192.168.1.100`).

3. **Share the game URL**
   Others can access your game at: `http://YOUR_IP_ADDRESS:5173`

### For Internet Play

For playing over the internet, you'll need to:

1. **Deploy the server** to a cloud service (Heroku, Railway, etc.)
2. **Update the client configuration** to point to your deployed server
3. **Configure firewall rules** to allow traffic on ports 2567 and 5173
4. **Set up SSL certificates** for secure connections

## Game Controls

- **Mouse/Touch**: Move your duck hunter
- **Click/Tap**: Interact with game elements
- **Room Code**: Share the room code with friends to play together

## Development

### Project Structure

```
DuckDuckQuack/
├── duckduckquack/          # React client application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── phaser/         # Phaser.js game logic
│   │   └── assets/         # Game assets
│   ├── .env.local          # Client environment variables
│   └── vite.config.ts      # Vite configuration with SSL support
├── duckduckquackServer/    # Colyseus server
│   ├── src/
│   │   ├── rooms/          # Game room logic
│   │   └── schema/         # Game state schemas
│   ├── .env                # Server environment variables
│   └── app.config.ts       # Server configuration with SSL/CORS
├── ssl/                    # SSL certificates (local development)
├── ENVIRONMENT_SETUP.md    # Detailed environment setup guide
└── setup-env.sh           # Automated environment setup script
```

### Available Scripts

**Client (duckduckquack/)**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

**Server (duckduckquackServer/)**
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

### Environment Setup Script

Use the automated setup script for quick configuration:

```bash
# Make script executable
chmod +x setup-env.sh

# Run setup
./setup-env.sh
```

The script will guide you through:
1. Development (No SSL)
2. Development (With SSL)
3. Production
4. Custom configuration

## Troubleshooting

### SSL Issues
- Check certificate paths are correct
- Ensure certificates are valid and not expired
- Verify file permissions on certificate files
- Make sure `VITE_ENABLE_SSL` matches server `ENABLE_SSL` setting

### CORS Issues
- Check `CORS_ORIGIN` configuration in server `.env`
- Ensure client URL matches allowed origins
- Verify protocol (http vs https) matches
- Check that `VITE_SERVER_HOST` and `VITE_SERVER_PORT` are correctly formatted

### Connection Issues
- Ensure both client and server are running
- Check that ports 2567 and 5173 are not blocked
- Verify network connectivity between devices
- Check firewall settings allow connections
- Verify environment variables are correctly set

### Environment Issues
- Make sure `.env.local` is in the client root directory
- Ensure `.env` is in the server root directory
- Check that environment variables are properly formatted
- Restart both client and server after changing environment variables

## Security Notes

1. **Never commit .env files** to version control
2. **Use strong secrets** in production
3. **Restrict CORS origins** in production
4. **Use HTTPS** in production
5. **Keep SSL certificates updated**
6. **Use environment-specific configurations**

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
