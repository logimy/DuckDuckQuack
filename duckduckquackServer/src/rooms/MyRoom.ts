import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player, Duck } from "./schema/MyRoomState";

// ====================== Types & Configuration ======================

type InputVec = { vx: number; vy: number };

interface Group {
  id: number;
  members: string[];
  size: number;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  targetId?: number;
  lockUntil: number;
}

const CONFIG = {
  WORLD: { WIDTH: 800, HEIGHT: 800 },
  NET: { FIXED_HZ: 60 },
  MOVE: { MAX_SPEED_PER_TICK: 7, EPS: 1e-6 },
  DUCK: {
    RADIUS: 10,
    SPEED_SOLO: 0.4,
    SPEED_GROUP_EQUAL: 0.05,
    SPEED_GROUP_BIGGER: 0.1,
    SPEED_FLEE: 7,
    MAX_ACCEL: 0.15,
    FLEE_ACCEL: 0.35,
    FLEE_EASE_EXP: 2.0,
    FLEE_MIN_FACTOR: 0.0,
    MERGE_RADIUS: 16,
    STICK_RADIUS: 26,
    BORDER_BUFFER: 30,
    PANIC_RADIUS: 180,
    PANIC_COOLDOWN_MS: 200,
    MERGE_LOCK_MS: 600,
    COLORS: ["red", "green", "blue", "yellow"],
    START_PER_COLOR: 4,
    START_SPREAD: 40,
  },
} as const;

const NICKNAME_REGEX = /^[A-Za-z0-9_-]{3,16}$/;

const MESSAGE_TYPES = {
  INPUT: 0 as const,
  SET_NICK: 1 as const,
};

// ====================== Utility Functions ======================

const hypot = Math.hypot;

const clamp = (value: number, min: number, max: number): number => 
  Math.min(Math.max(value, min), max);

const normalize = (x: number, y: number): [number, number, number] => {
  const magnitude = hypot(x, y) || 1;
  return [x / magnitude, y / magnitude, magnitude];
};

const accelerateToward = (vx: number, vy: number, targetX: number, targetY: number, maxAccel: number): [number, number] => {
  let ax = targetX - vx;
  let ay = targetY - vy;
  const acceleration = hypot(ax, ay);
  
  if (acceleration > maxAccel) {
    const scale = maxAccel / acceleration;
    ax *= scale;
    ay *= scale;
  }
  
  return [vx + ax, vy + ay];
};

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;
  private roomCode?: string;
  private static roomMap = new Map<string, string>(); // roomCode -> roomId

  private elapsedCarry = 0;
  private groupSequence = 1;

  // ====================== Room Lifecycle ======================

  onCreate(options?: any): void {
    this.setState(new MyRoomState());
    this.roomCode = options?.roomCode;
    
    console.log('Room created:', { roomCode: this.roomCode, roomId: this.roomId });
    
    if (this.roomCode) {
      MyRoom.roomMap.set(this.roomCode, this.roomId);
    }
    
    this.spawnInitialDucks();
    this.setupSimulation();
    this.setupMessageHandlers();
  }

  onJoin(client: Client, options?: any): void {
    console.log('Player joined:', { roomCode: this.roomCode, clientId: client.sessionId });
    
    const player = new Player();
    player.x = Math.floor(Math.random() * CONFIG.WORLD.WIDTH);
    player.y = Math.floor(Math.random() * CONFIG.WORLD.HEIGHT);
    
    const nickname = typeof options?.nickname === "string" ? options.nickname.trim() : "";
    player.nickname = NICKNAME_REGEX.test(nickname) ? nickname : "";
    
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }

  onDispose(): void {
    if (this.roomCode) {
      MyRoom.roomMap.delete(this.roomCode);
    }
  }
  
  static getRoomIdByCode(roomCode: string): string | undefined {
    return MyRoom.roomMap.get(roomCode);
  }

  // ====================== Setup Methods ======================

  private setupSimulation(): void {
    const step = 1000 / CONFIG.NET.FIXED_HZ;
    this.setSimulationInterval((dt) => {
      this.elapsedCarry += dt;
      while (this.elapsedCarry >= step) {
        this.elapsedCarry -= step;
        this.fixedTick();
      }
    });
  }

  private setupMessageHandlers(): void {
    this.onMessage<InputVec>(MESSAGE_TYPES.INPUT, (client, payload) => 
      this.handleInput(client, payload));

    this.onMessage<string>(MESSAGE_TYPES.SET_NICK, (client, nickname) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || typeof nickname !== "string") return;
      
      const trimmed = nickname.trim();
      if (NICKNAME_REGEX.test(trimmed)) {
        player.nickname = trimmed;
      }
    });
  }

  // ====================== Player Management ======================
  private handleInput(client: Client, payload?: Partial<InputVec>): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const vx = Number(payload?.vx);
    const vy = Number(payload?.vy);
    
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) return;

    const inputQueue = player.inputQueue as InputVec[];
    inputQueue.push({ vx, vy });
    
    // Keep only the latest 4 inputs
    if (inputQueue.length > 4) {
      inputQueue.splice(0, inputQueue.length - 4);
    }
  }

  private dequeueLatestInput(player: Player): InputVec | undefined {
    const inputQueue = player.inputQueue as InputVec[];
    return inputQueue.pop();
  }

  private sanitizeInput({ vx, vy }: InputVec): InputVec {
    const magnitude = hypot(vx, vy);
    
    if (magnitude < CONFIG.MOVE.EPS) {
      return { vx: 0, vy: 0 };
    }
    
    if (magnitude > CONFIG.MOVE.MAX_SPEED_PER_TICK) {
      const scale = CONFIG.MOVE.MAX_SPEED_PER_TICK / magnitude;
      return { vx: vx * scale, vy: vy * scale };
    }
    
    return { vx, vy };
  }

  private movePlayer(player: Player, vx: number, vy: number): void {
    player.x += vx;
    player.y += vy;
    this.clampToWorld(player);
  }

  private clampToWorld(player: Player): void {
    const { WIDTH, HEIGHT } = CONFIG.WORLD;
    player.x = clamp(player.x, 0, WIDTH);
    player.y = clamp(player.y, 0, HEIGHT);
  }

  // ====================== Duck Management ======================

  private spawnInitialDucks(): void {
    const { WIDTH, HEIGHT } = CONFIG.WORLD;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const spread = CONFIG.DUCK.START_SPREAD;

    for (const color of CONFIG.DUCK.COLORS) {
      for (let i = 0; i < CONFIG.DUCK.START_PER_COLOR; i++) {
        const duck = new Duck();
        duck.color = color;
        duck.x = centerX + (Math.random() * 2 - 1) * spread;
        duck.y = centerY + (Math.random() * 2 - 1) * spread;
        duck.vx = 0;
        duck.vy = 0;
        duck.panicUntil = 0;
        
        const duckId = `${color}-${i}-${Math.random().toString(36).slice(2, 6)}`;
        this.state.ducks.set(duckId, duck);
      }
    }
  }

  private buildGroups(currentTime: number): Group[] {
    const duckKeys = Array.from(this.state.ducks.keys());
    const visited = new Set<string>();
    const groups: Group[] = [];
    const stickRadiusSquared = CONFIG.DUCK.STICK_RADIUS * CONFIG.DUCK.STICK_RADIUS;

    for (const duckKey of duckKeys) {
      if (visited.has(duckKey)) continue;
      
      const duck = this.state.ducks.get(duckKey)!;
      if (duck.panicUntil > currentTime) {
        visited.add(duckKey);
        continue;
      }

      const queue = [duckKey];
      const members: string[] = [];
      visited.add(duckKey);

      // Flood fill to find connected ducks
      while (queue.length > 0) {
        const currentKey = queue.pop()!;
        const currentDuck = this.state.ducks.get(currentKey)!;
        
        if (currentDuck.panicUntil > currentTime) continue;

        members.push(currentKey);

        // Check all other ducks for connectivity
        for (const otherKey of duckKeys) {
          if (visited.has(otherKey)) continue;
          
          const otherDuck = this.state.ducks.get(otherKey)!;
          if (otherDuck.panicUntil > currentTime) continue;

          const dx = otherDuck.x - currentDuck.x;
          const dy = otherDuck.y - currentDuck.y;
          const distanceSquared = dx * dx + dy * dy;
          
          if (distanceSquared <= stickRadiusSquared) {
            visited.add(otherKey);
            queue.push(otherKey);
          }
        }
      }

      // Create group if we have at least 2 ducks
      if (members.length >= 2) {
        let sumX = 0, sumY = 0;
        for (const memberKey of members) {
          const member = this.state.ducks.get(memberKey)!;
          sumX += member.x;
          sumY += member.y;
        }
        
        const centerX = sumX / members.length;
        const centerY = sumY / members.length;
        
        groups.push({
          id: this.groupSequence++,
          members,
          size: members.length,
          cx: centerX,
          cy: centerY,
          vx: 0,
          vy: 0,
          lockUntil: 0
        });
      }
    }
    
    return groups;
  }

  private chooseTargetGroup(myGroup: Group, allGroups: Group[]): Group | undefined {
    let bestTarget: Group | undefined;
    let bestDistanceSquared = Infinity;

    for (const group of allGroups) {
      if (group.id === myGroup.id || group.size < myGroup.size) continue;
      
      const dx = group.cx - myGroup.cx;
      const dy = group.cy - myGroup.cy;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        bestTarget = group;
      } else if (distanceSquared === bestDistanceSquared && bestTarget) {
        // Tie-breaker: prefer larger groups, then lower ID
        if (group.size > bestTarget.size || 
            (group.size === bestTarget.size && group.id < bestTarget.id)) {
          bestTarget = group;
        }
      }
    }
    
    return bestTarget;
  }

  // ====================== Duck AI & Physics ======================

  private applyFleeBehavior(currentTime: number): void {
    const players = Array.from(this.state.players.values());
    if (players.length === 0) return;

    const panicRadius = CONFIG.DUCK.PANIC_RADIUS;
    const maxFleeSpeed = CONFIG.DUCK.SPEED_FLEE;
    const maxAcceleration = CONFIG.DUCK.FLEE_ACCEL;
    const easeExponent = CONFIG.DUCK.FLEE_EASE_EXP;
    const minFleeFactor = CONFIG.DUCK.FLEE_MIN_FACTOR;
    const minFleeSpeed = CONFIG.DUCK.SPEED_SOLO;

    for (const duck of this.state.ducks.values()) {
      let fleeX = 0, fleeY = 0;
      let nearestPlayerDistance = Infinity;
      let anyPlayerInPanicRadius = false;
      let playerCenterX = 0, playerCenterY = 0;

      // Calculate flee vector from all players
      for (const player of players) {
        const dx = duck.x - player.x;
        const dy = duck.y - player.y;
        const distance = hypot(dx, dy) || 1;

        playerCenterX += player.x;
        playerCenterY += player.y;

        if (distance <= panicRadius) {
          anyPlayerInPanicRadius = true;
        }
        
        if (distance < nearestPlayerDistance) {
          nearestPlayerDistance = distance;
        }

        // Quadratic falloff: full strength at distance 0, zero at panic radius
        const normalizedDistance = clamp(1 - distance / panicRadius, 0, 1);
        const weight = normalizedDistance * normalizedDistance;

        fleeX += (dx / distance) * weight;
        fleeY += (dy / distance) * weight;
      }

      // Set panic state if any player is in panic radius
      if (anyPlayerInPanicRadius) {
        duck.panicUntil = currentTime + CONFIG.DUCK.PANIC_COOLDOWN_MS;
      }

      // Apply flee behavior if duck is panicking
      if (duck.panicUntil > currentTime) {
        // If flee vector is too small and multiple players exist, flee from center
        if (Math.abs(fleeX) + Math.abs(fleeY) < 1e-3 && players.length > 1) {
          const centerX = playerCenterX / players.length;
          const centerY = playerCenterY / players.length;
          fleeX = duck.x - centerX;
          fleeY = duck.y - centerY;
        }

        if (fleeX !== 0 || fleeY !== 0) {
          const [normalizedX, normalizedY] = normalize(fleeX, fleeY);

          // Calculate flee speed based on distance to nearest player
          const normalizedNearestDistance = clamp(1 - nearestPlayerDistance / panicRadius, 0, 1);
          const fleeFactor = Math.max(minFleeFactor, Math.pow(normalizedNearestDistance, easeExponent));
          const targetSpeed = Math.max(minFleeSpeed, maxFleeSpeed * fleeFactor);

          const targetVelocityX = normalizedX * targetSpeed;
          const targetVelocityY = normalizedY * targetSpeed;

          [duck.vx, duck.vy] = accelerateToward(duck.vx, duck.vy, targetVelocityX, targetVelocityY, maxAcceleration);
        }
      }
    }
  }

  private resolveCollisionsAndBorders(): void {
    const duckKeys = Array.from(this.state.ducks.keys());
    const duckRadius = CONFIG.DUCK.RADIUS;
    const collisionDistance = duckRadius * 2;
    const collisionDistanceSquared = collisionDistance * collisionDistance;
    const { WIDTH, HEIGHT } = CONFIG.WORLD;
    const borderBuffer = CONFIG.DUCK.BORDER_BUFFER;

    // Multiple passes for stable collision resolution
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < duckKeys.length; i++) {
        const duckKey1 = duckKeys[i];
        const duck1 = this.state.ducks.get(duckKey1)!;

        // Duck-to-duck collision separation
        for (let j = i + 1; j < duckKeys.length; j++) {
          const duckKey2 = duckKeys[j];
          const duck2 = this.state.ducks.get(duckKey2)!;
          
          const dx = duck2.x - duck1.x;
          const dy = duck2.y - duck1.y;
          const distanceSquared = dx * dx + dy * dy;
          
          if (distanceSquared > 0 && distanceSquared < collisionDistanceSquared) {
            const distance = Math.sqrt(distanceSquared) || 1;
            const overlap = collisionDistance - distance;
            const normalX = dx / distance;
            const normalY = dy / distance;
            const pushForce = overlap * 0.5;
            
            duck1.x -= normalX * pushForce;
            duck1.y -= normalY * pushForce;
            duck2.x += normalX * pushForce;
            duck2.y += normalY * pushForce;
          }
        }

        // Soft border bias (gentle push toward center)
        if (duck1.x < borderBuffer) {
          duck1.vx += (borderBuffer - duck1.x) * 0.01;
        } else if (duck1.x > WIDTH - borderBuffer) {
          duck1.vx -= (duck1.x - (WIDTH - borderBuffer)) * 0.01;
        }
        
        if (duck1.y < borderBuffer) {
          duck1.vy += (borderBuffer - duck1.y) * 0.01;
        } else if (duck1.y > HEIGHT - borderBuffer) {
          duck1.vy -= (duck1.y - (HEIGHT - borderBuffer)) * 0.01;
        }

        // Hard border clamping with velocity damping
        if (duck1.x < duckRadius) {
          duck1.x = duckRadius;
          if (duck1.vx < 0) duck1.vx *= 0.3;
        }
        if (duck1.x > WIDTH - duckRadius) {
          duck1.x = WIDTH - duckRadius;
          if (duck1.vx > 0) duck1.vx *= 0.3;
        }
        
        if (duck1.y < duckRadius) {
          duck1.y = duckRadius;
          if (duck1.vy < 0) duck1.vy *= 0.3;
        }
        if (duck1.y > HEIGHT - duckRadius) {
          duck1.y = HEIGHT - duckRadius;
          if (duck1.vy > 0) duck1.vy *= 0.3;
        }
      }
    }
  }

  // ====================== Main Game Loop ======================

  private fixedTick(): void {
    const currentTime = Date.now();

    // 1. Process player input and movement
    this.processPlayerMovement();

    // 2. Apply duck flee behavior from players
    this.applyFleeBehavior(currentTime);

    // 3. Build duck groups (excluding panicking ducks)
    const groups = this.buildGroups(currentTime);

    // 4. Set group movement targets and velocities
    this.updateGroupBehavior(groups, currentTime);

    // 5. Handle solo duck seeking behavior
    this.updateSoloDuckBehavior(groups, currentTime);

    // 6. Apply group velocities to member ducks
    this.applyGroupVelocities(groups, currentTime);

    // 7. Integrate duck positions
    this.integrateDuckPositions();

    // 8. Resolve collisions and border constraints
    this.resolveCollisionsAndBorders();
  }

  private processPlayerMovement(): void {
    this.state.players.forEach((player) => {
      const input = this.dequeueLatestInput(player);
      if (!input) return;
      
      const { vx, vy } = this.sanitizeInput(input);
      this.movePlayer(player, vx, vy);
    });
  }

  private updateGroupBehavior(groups: Group[], currentTime: number): void {
    for (const group of groups) {
      if (group.lockUntil > currentTime) continue;
      
      const target = this.chooseTargetGroup(group, groups);
      if (!target) {
        group.vx = 0;
        group.vy = 0;
        group.targetId = undefined;
        continue;
      }

      const [normalizedX, normalizedY] = normalize(target.cx - group.cx, target.cy - group.cy);
      const isSameSize = target.size === group.size;
      const speed = isSameSize ? CONFIG.DUCK.SPEED_GROUP_EQUAL : CONFIG.DUCK.SPEED_GROUP_BIGGER;
      
      group.vx = normalizedX * speed;
      group.vy = normalizedY * speed;
      group.targetId = target.id;
      group.lockUntil = currentTime + CONFIG.DUCK.MERGE_LOCK_MS;
    }
  }

  private updateSoloDuckBehavior(groups: Group[], currentTime: number): void {
    const groupedDuckKeys = new Set(groups.flatMap((group) => group.members));
    const duckKeys = Array.from(this.state.ducks.keys());

    for (const duckKey of duckKeys) {
      const duck = this.state.ducks.get(duckKey)!;
      if (duck.panicUntil > currentTime || groupedDuckKeys.has(duckKey)) continue;

      let bestTargetX = 0, bestTargetY = 0, bestDistanceSquared = Infinity;

      // Find nearest non-panicking duck
      for (const otherKey of duckKeys) {
        if (otherKey === duckKey) continue;
        
        const otherDuck = this.state.ducks.get(otherKey)!;
        if (otherDuck.panicUntil > currentTime) continue;
        
        const dx = otherDuck.x - duck.x;
        const dy = otherDuck.y - duck.y;
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared < bestDistanceSquared) {
          bestDistanceSquared = distanceSquared;
          bestTargetX = dx;
          bestTargetY = dy;
        }
      }

      // Find nearest group centroid
      for (const group of groups) {
        const dx = group.cx - duck.x;
        const dy = group.cy - duck.y;
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared < bestDistanceSquared) {
          bestDistanceSquared = distanceSquared;
          bestTargetX = dx;
          bestTargetY = dy;
        }
      }

      if (bestDistanceSquared < Infinity) {
        const [normalizedX, normalizedY] = normalize(bestTargetX, bestTargetY);
        const targetVelocityX = normalizedX * CONFIG.DUCK.SPEED_SOLO;
        const targetVelocityY = normalizedY * CONFIG.DUCK.SPEED_SOLO;
        
        [duck.vx, duck.vy] = accelerateToward(duck.vx, duck.vy, targetVelocityX, targetVelocityY, CONFIG.DUCK.MAX_ACCEL);
      }
    }
  }

  private applyGroupVelocities(groups: Group[], currentTime: number): void {
    for (const group of groups) {
      for (const memberKey of group.members) {
        const member = this.state.ducks.get(memberKey)!;
        if (member.panicUntil > currentTime) continue;
        
        [member.vx, member.vy] = accelerateToward(member.vx, member.vy, group.vx, group.vy, CONFIG.DUCK.MAX_ACCEL);
      }
    }
  }

  private integrateDuckPositions(): void {
    for (const duck of this.state.ducks.values()) {
      duck.x += duck.vx;
      duck.y += duck.vy;
    }
  }
}
