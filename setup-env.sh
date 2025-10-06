#!/bin/bash

# DuckDuckQuack Environment Setup Script

echo "🚀 DuckDuckQuack Environment Setup"
echo "=================================="

# Function to create .env files
create_env_file() {
    local file_path=$1
    local content=$2
    
    if [ -f "$file_path" ]; then
        echo "⚠️  $file_path already exists. Backing up to ${file_path}.backup"
        cp "$file_path" "${file_path}.backup"
    fi
    
    echo "$content" > "$file_path"
    echo "✅ Created $file_path"
}

# Check if we're in the right directory
if [ ! -d "duckduckquack" ] || [ ! -d "duckduckquackServer" ]; then
    echo "❌ Please run this script from the DuckDuckQuack root directory"
    exit 1
fi

echo ""
echo "Select environment setup:"
echo "1) Development (No SSL)"
echo "2) Development (With SSL)"
echo "3) Production"
echo "4) Custom"
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "🔧 Setting up Development environment (No SSL)..."
        
        # Client .env.local
        create_env_file "duckduckquack/.env.local" "VITE_SERVER_HOST=localhost
VITE_SERVER_PORT=2567
VITE_ENABLE_SSL=false
VITE_NODE_ENV=development"
        
        # Server .env
        create_env_file "duckduckquackServer/.env" "PORT=2567
NODE_ENV=development
ENABLE_SSL=false
CORS_ORIGIN=*"
        ;;
        
    2)
        echo "🔧 Setting up Development environment (With SSL)..."
        
        # Check if SSL certificates exist
        if [ ! -f "ssl/localhost.pem" ] || [ ! -f "ssl/localhost-key.pem" ]; then
            echo "⚠️  SSL certificates not found. Creating them..."
            mkdir -p ssl
            
            # Check if mkcert is installed
            if ! command -v mkcert &> /dev/null; then
                echo "❌ mkcert is not installed. Please install it first:"
                echo "   npm install -g mkcert"
                echo "   mkcert -install"
                exit 1
            fi
            
            mkcert localhost 127.0.0.1 ::1
            mv localhost+2.pem ssl/localhost.pem
            mv localhost+2-key.pem ssl/localhost-key.pem
            echo "✅ SSL certificates created"
        fi
        
        # Client .env.local
        create_env_file "duckduckquack/.env.local" "VITE_SERVER_HOST=localhost
VITE_SERVER_PORT=2567
VITE_ENABLE_SSL=true
VITE_SSL_KEY_PATH=./ssl/localhost-key.pem
VITE_SSL_CERT_PATH=./ssl/localhost.pem
VITE_NODE_ENV=development"
        
        # Server .env
        create_env_file "duckduckquackServer/.env" "PORT=2567
NODE_ENV=development
ENABLE_SSL=true
SSL_CERT_PATH=./ssl/localhost.pem
SSL_KEY_PATH=./ssl/localhost-key.pem
CORS_ORIGIN=*"
        ;;
        
    3)
        echo "🔧 Setting up Production environment..."
        
        read -p "Enter your domain (e.g., yourdomain.com): " domain
        read -p "Enter SSL certificate path: " cert_path
        read -p "Enter SSL key path: " key_path
        
        # Client .env.local
        create_env_file "duckduckquack/.env.local" "VITE_SERVER_HOST=${domain}
VITE_SERVER_PORT=2567
VITE_ENABLE_SSL=true
VITE_NODE_ENV=production"
        
        # Server .env
        create_env_file "duckduckquackServer/.env" "PORT=2567
NODE_ENV=production
ENABLE_SSL=true
SSL_CERT_PATH=${cert_path}
SSL_KEY_PATH=${key_path}
CORS_ORIGIN=https://${domain},https://www.${domain}
        ;;
        
    4)
        echo "🔧 Custom setup..."
        
        read -p "Server Host (e.g., localhost or yourdomain.com): " server_host
        read -p "Server Port (e.g., 2567): " server_port
        read -p "Enable SSL? (y/n): " enable_ssl
        read -p "Environment (development/production): " env
        
        ssl_flag="false"
        if [ "$enable_ssl" = "y" ]; then
            ssl_flag="true"
        fi
        
        # Client .env.local
        create_env_file "duckduckquack/.env.local" "VITE_SERVER_HOST=${server_host}
VITE_SERVER_PORT=${server_port}
VITE_ENABLE_SSL=${ssl_flag}
VITE_NODE_ENV=${env}"
        
        # Server .env
        create_env_file "duckduckquackServer/.env" "PORT=2567
NODE_ENV=${env}
ENABLE_SSL=${ssl_flag}
CORS_ORIGIN=*"
        ;;
        
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the server: cd duckduckquackServer && npm start"
echo "2. Start the client: cd duckduckquack && npm run dev"
echo ""
echo "📖 For more information, see ENVIRONMENT_SETUP.md"
