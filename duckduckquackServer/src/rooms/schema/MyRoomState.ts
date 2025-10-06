import { MapSchema, Schema, type } from "@colyseus/schema";

/**
 * Player entity representing a connected client
 */
export class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") nickname: string = "";
  
  // Server-side input queue for client input processing
  inputQueue: any[] = [];
}

/**
 * Duck entity with AI behavior and physics
 */
export class Duck extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("string") color: string = "red";
  
  // Panic state timestamp (ms) - synced for debugging
  @type("number") panicUntil: number = 0;
}

/**
 * Main game state containing all entities
 */
export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Duck }) ducks = new MapSchema<Duck>();
}
