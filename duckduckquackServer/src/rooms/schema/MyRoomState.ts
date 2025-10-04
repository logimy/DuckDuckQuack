import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  inputQueue: any[] = [];
}

export class Duck extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("string") color: string = "red";
  /** ms timestamp; server-only consumers read/write, value syncs for debugging */
  @type("number") panicUntil: number = 0;
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Duck }) ducks = new MapSchema<Duck>();
}