# DuckDuckQuack 🦆

A real-time multiplayer duck hunting game built with React, TypeScript, Phaser.js, and Colyseus.

## 🎮 About

DuckDuckQuack is a fun multiplayer game where players hunt ducks in a shared game world. Players can create or join rooms using room codes, customize game settings, and compete in real-time duck hunting sessions.

## ✨ Features

- **Real-time Multiplayer**: Join rooms with friends using room codes
- **Duck Hunting Gameplay**: Hunt ducks in a shared game world
- **Cross-Platform**: Works on desktop and mobile browsers
- **Room-based Gaming**: Create or join rooms with unique codes
- **Game Customization**: Customize duck colors and count
- **SSL/TLS Support**: Secure connections for production deployments
- **Environment Configuration**: Flexible setup for development and production

## 🚀 Quick Start

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
   ```bash
   # Run the automated setup script
   ./setup-env.sh
   ```

4. **Start the application**
   ```bash
   # Start the server (in one terminal)
   cd duckduckquackServer
   npm start
   
   # Start the client (in another terminal)
   cd duckduckquack
   npm run dev
   ```

5. **Play the game**
   - Open `http://localhost:5173` in your browser
   - Create a room or join with a room code
   - Start hunting ducks!

## 📁 Project Structure

```
DuckDuckQuack/
├── duckduckquack/          # React client application
│   ├── src/
│   │   ├── components/     # React components (LobbyScreen, WinScreen)
│   │   ├── phaser/         # Phaser.js game logic
│   │   └── assets/         # Game assets (sounds, images)
│   ├── .env.local          # Client environment variables
│   └── vite.config.ts      # Vite configuration
├── duckduckquackServer/    # Colyseus server
│   ├── src/
│   │   ├── rooms/          # Game room logic
│   │   └── schema/          # Game state schemas
│   ├── .env                # Server environment variables
│   └── app.config.ts       # Server configuration
├── ssl/                    # SSL certificates (local development)
├── ENVIRONMENT_SETUP.md    # Detailed environment setup guide
└── setup-env.sh           # Automated environment setup script
```

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, Vite
- **Game Engine**: Phaser.js
- **Multiplayer**: Colyseus (WebSocket-based)
- **Styling**: CSS3 with modern features
- **Build Tools**: Vite, TypeScript
- **Server**: Node.js, Express, Colyseus

## 🎯 Game Controls

- **Mouse/Touch**: Move your duck hunter
- **Click/Tap**: Interact with game elements
- **Room Code**: Share the room code with friends to play together

## 🌐 Multiplayer Setup

### Local Network Play
1. Find your computer's IP address
2. Update `VITE_SERVER_HOST` in `duckduckquack/.env.local` to your IP
3. Share `http://YOUR_IP:5173` with friends

### Internet Play
1. Deploy the server to a cloud service
2. Update client configuration to point to your deployed server
3. Set up SSL certificates for secure connections

## 📚 Documentation

- **[Client README](duckduckquack/README.md)** - Detailed client setup and configuration
- **[Server README](duckduckquackServer/README.md)** - Server setup and deployment
- **[Environment Setup Guide](ENVIRONMENT_SETUP.md)** - Comprehensive environment configuration

## 🔧 Development

### Available Scripts

**Client:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

**Server:**
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

### Environment Setup

Use the automated setup script for quick configuration:
```bash
./setup-env.sh
```

## 🚀 Deployment

The application supports both development and production deployments with:
- SSL/TLS support
- Environment-based configuration
- Docker deployment options
- Cloud platform compatibility

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Happy Duck Hunting!** 🦆🎯
