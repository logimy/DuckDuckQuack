import lmbUrl from "../../src/assets/LMB.png";

const getServerUrl = () => {
  const serverHost = import.meta.env.VITE_SERVER_HOST || "localhost";
  const serverPort = import.meta.env.VITE_SERVER_PORT || "2567";
  const enableSSL = import.meta.env.VITE_ENABLE_SSL === "true";
  const protocol = enableSSL ? "wss://" : "ws://";
  return `${protocol}${serverHost}:${serverPort}`;
};

export const CONFIG = {
  world: { 
    width: 800, 
    height: 800 
  },
  
  net: { 
    fixedHz: 60 
  },
  
  move: { 
    maxSpeedPerTick: 7, 
    deadZone: 4, 
    followGain: 0.25, 
    velAlpha: 0.35, 
    targetAlpha: 0.25 
  },
  
  reconcile: { 
    smallErrPx: 1.5, 
    snapErrPx: 64, 
    alpha: 0.12 
  },
  
  remote: { 
    lerpAlpha: 0.2 
  },

  ducks: {
    radius: 10,
    lerpAlpha: 0.2,
    depth: 91,
  },

  player: {
    radius: 14,
    strokeWidth: 3,
    fill: 0xffffff,
    stroke: 0x222222,
    textureKey: "player_circle",
    depth: 92,
  },

  assets: {
    ship: "ship_0001",
    shipUrl: "https://cdn.glitch.global/3e033dcd-d5be-4db4-99e8-086ae90969ec/ship_0001.png",
    lmb: "lmb_icon",
    lmbUrl
  },
  
  server: {
    url: getServerUrl(),
    roomName: "my_room",
  },
  
  ui: { 
    containerId: "game-container", 
    unlockedClass: "is-unlocked" 
  },
} as const;
