import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { MyRoom } from "./rooms/MyRoom";

export default config({
    initializeGameServer: (gameServer) => {
        // Define room handler for DuckDuckQuack game
        gameServer.define('my_room', MyRoom);
    },

    initializeExpress: (app) => {
        // Health check endpoint
        app.get("/hello_world", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        // Room lookup API - get room ID by room code
        app.get("/room/:roomCode", (req, res) => {
            const roomCode = req.params.roomCode;
            const roomId = MyRoom.getRoomIdByCode(roomCode);
            
            res.json({ 
                roomId: roomId || null, 
                exists: !!roomId 
            });
        });

        // Development tools (disabled in production)
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }

        // Server monitoring dashboard
        app.use("/monitor", monitor());
    },

    beforeListen: () => {
        // Pre-server initialization hook
    }
});
