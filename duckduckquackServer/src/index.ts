/**
 * DuckDuckQuack Server Entry Point
 * 
 * Note: This file is auto-managed by Colyseus Cloud.
 * For self-hosting, see: https://docs.colyseus.io/server/api/#constructor-options
 */
import { listen } from "@colyseus/tools";
import app from "./app.config";

// Start server on port 2567 (or PORT environment variable)
listen(app);
