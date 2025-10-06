import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { MyRoom } from "./rooms/MyRoom";
import cors from "cors";
import fs from "fs";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";
const enableSSL = process.env.ENABLE_SSL === "true";
const port = parseInt(process.env.PORT || "2567");

const getCorsOrigin = () => {
  if (isProduction) {
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin && corsOrigin !== "*") {
      return corsOrigin.split(",").map(origin => origin.trim());
    }
    return false; // Disable CORS in production if not configured
  }
  return true; // Allow all origins in development
};

export default config({
    initializeGameServer: (gameServer) => {
        gameServer.define('my_room', MyRoom);
    },

    initializeExpress: (app) => {
        app.use(cors({
            origin: getCorsOrigin(),
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        app.get("/hello_world", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        app.get("/room/:roomCode", (req, res) => {
            const roomCode = req.params.roomCode;
            const roomId = MyRoom.getRoomIdByCode(roomCode);
            
            res.json({ 
                roomId: roomId || null, 
                exists: !!roomId 
            });
        });

        if (!isProduction) {
            app.use("/", playground());
        }

        app.use("/monitor", monitor());
    },

    beforeListen: () => {
        console.log(`🚀 DuckDuckQuack Server starting...`);
        console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔒 SSL Enabled: ${enableSSL}`);
        console.log(`🌐 Port: ${port}`);
        console.log(`🔗 CORS Origin: ${isProduction ? 'Restricted' : 'All Origins'}`);
    },

    // SSL Configuration
    ...(enableSSL && {
        https: {
            key: fs.readFileSync(process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/private.key')),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/certificate.crt'))
        }
    })
});
