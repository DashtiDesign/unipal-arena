import { GameComponentProps } from "./types";
import { Chip } from "@heroui/react";

const AREA_W = 320;
const AREA_H = 340;
const LOGO_SIZE = 80;

interface Target { id: string; x: number; y: number }
interface State {
  slots: Record<string, { logo: Target; bomb: Target | null }>;
  hits: Record<string, number>;
}

function UnipalLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 640 640" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M467.094 328.796C457.873 349.874 442.724 367.815 423.495 380.431C404.265 393.047 381.785 399.794 358.791 399.85V238.512C358.791 238.774 358.791 239.189 358.791 239.799C358.791 239.974 358.791 240.191 358.791 240.387V241.085C359.859 251.092 367.985 285.78 428.509 309.305C441.993 314.34 454.887 320.832 466.964 328.665" fill="#FF5900"/>
      <path d="M461.389 561.333C461.396 572.637 460.323 583.917 458.185 595.018C457.675 597.562 456.297 599.85 454.285 601.489C452.274 603.128 449.755 604.015 447.162 604H124.541C123.065 604 121.603 603.709 120.239 603.143C118.875 602.578 117.636 601.75 116.592 600.705C115.548 599.66 114.72 598.42 114.155 597.055C113.59 595.69 113.299 594.227 113.299 592.75V259.742C113.242 219.03 127.46 179.589 153.475 148.288C143.898 148.527 134.388 146.635 125.631 142.751C118.989 139.364 113.638 133.895 110.396 127.178C107.154 120.461 106.199 112.867 107.678 105.556C107.805 104.556 108.18 103.605 108.77 102.788C109.359 101.972 110.145 101.316 111.054 100.883C111.962 100.449 112.965 100.25 113.97 100.304C114.975 100.359 115.951 100.665 116.807 101.195C123.31 105.288 130.244 108.652 137.483 111.225C131.71 106.325 127.165 100.14 124.21 93.1664C121.256 86.1926 119.973 78.6233 120.467 71.0647C120.566 69.9782 120.959 68.9391 121.603 68.0587C122.247 67.1782 123.118 66.4899 124.123 66.0666C125.127 65.6433 126.228 65.5015 127.307 65.6561C128.387 65.8107 129.403 66.2558 130.249 66.9442C137.222 72.6141 144.495 77.9049 152.036 82.7942C147.3 76.7371 144.006 69.6801 142.402 62.159C140.797 54.6378 140.925 46.8501 142.777 39.3859C143.093 38.2629 143.729 37.2558 144.606 36.4877C145.484 35.7195 146.565 35.2238 147.719 35.0598C148.874 34.8958 150.051 35.0708 151.108 35.5641C152.164 36.0574 153.054 36.8477 153.67 37.8383C183.257 84.0374 243.955 85.3232 279.511 85.3232C282.256 85.2142 285.046 85.1269 287.813 85.1269H359.164V111.29H334.784C315.62 110.96 296.58 114.434 278.765 121.512C260.95 128.589 244.714 139.13 230.995 152.525C217.275 165.919 206.343 181.902 198.833 199.549C191.322 217.196 187.381 236.158 187.237 255.338C187.093 274.519 190.75 293.537 197.995 311.295C205.24 329.053 215.93 345.198 229.447 358.797C242.964 372.396 259.04 383.18 276.747 390.525C294.453 397.869 313.439 401.629 332.606 401.587H359.099C389.648 415.637 415.53 438.157 433.679 466.477C451.828 494.798 461.483 527.733 461.498 561.377" fill="#001A9C"/>
      <path d="M522.106 365.772C521.834 366.848 521.271 367.828 520.478 368.605C519.686 369.382 518.696 369.925 517.615 370.175C516.535 370.426 515.406 370.373 514.353 370.023C513.301 369.673 512.365 369.04 511.649 368.193C489.55 341.717 460.964 321.433 428.685 309.326C368.204 285.802 360.099 251.114 358.966 241.107C358.835 239.777 358.813 238.927 358.813 238.513V83.4762C430.863 83.4762 573.523 158.214 522.041 365.772" fill="#FF8B00"/>
      <path d="M358.813 109.551V399.849H332.32C293.851 399.849 256.959 384.557 229.758 357.336C202.556 330.115 187.274 293.196 187.274 254.7C187.274 216.204 202.556 179.285 229.758 152.065C256.959 124.844 293.851 109.551 332.32 109.551H358.813Z" fill="white"/>
      <path d="M324.521 201.906C324.521 208.404 322.595 214.758 318.987 220.161C315.379 225.564 310.253 229.774 304.253 232.261C298.254 234.748 291.652 235.398 285.283 234.131C278.914 232.863 273.063 229.734 268.472 225.139C263.88 220.544 260.753 214.69 259.486 208.316C258.22 201.943 258.87 195.336 261.355 189.332C263.84 183.329 268.047 178.198 273.446 174.588C278.846 170.978 285.194 169.051 291.688 169.051C292.618 169.051 293.54 169.086 294.455 169.159C295.006 169.212 295.529 169.422 295.966 169.762C296.403 170.101 296.734 170.558 296.921 171.079C297.108 171.6 297.144 172.164 297.023 172.704C296.903 173.244 296.632 173.738 296.241 174.13C293.164 177.209 291.435 181.385 291.435 185.739C291.435 190.094 293.164 194.271 296.241 197.35C299.318 200.429 303.492 202.159 307.843 202.159C312.195 202.159 316.367 200.429 319.444 197.35C319.836 196.959 320.331 196.688 320.871 196.567C321.411 196.447 321.973 196.482 322.494 196.67C323.014 196.857 323.472 197.188 323.811 197.625C324.151 198.062 324.359 198.586 324.412 199.137C324.412 200.053 324.521 200.969 324.521 201.906Z" fill="black"/>
    </svg>
  );
}

export default function WhackALogo({ publicState, playerId, opponentId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const myHits  = s.hits[playerId]   ?? 0;
  const oppHits = s.hits[opponentId] ?? 0;
  const mySlot  = s.slots[playerId];

  return (
    <div className="flex flex-col items-center gap-3 py-4 w-full select-none">
      <div className="flex justify-around w-full">
        <div className="flex flex-col items-center">
          <span className="text-xs text-(--muted) uppercase">You</span>
          <span className="text-4xl font-bold tabular-nums text-(--accent)">{myHits}</span>
        </div>
        <Chip size="sm" color="default" variant="secondary" className="self-center">{Math.ceil(remainingMs / 1000)}s</Chip>
        <div className="flex flex-col items-center">
          <span className="text-xs text-(--muted) uppercase">Opponent</span>
          <span className="text-4xl font-bold tabular-nums text-(--success)">{oppHits}</span>
        </div>
      </div>

      <div
        className="relative bg-(--surface-secondary) rounded-2xl overflow-hidden border border-(--border)"
        style={{ width: AREA_W, height: AREA_H, touchAction: "none" }}
      >
        {mySlot?.logo && (
          <button
            key={mySlot.logo.id}
            className="absolute p-0 border-none bg-transparent active:scale-90 transition-transform duration-75"
            style={{ left: mySlot.logo.x, top: mySlot.logo.y, width: LOGO_SIZE, height: LOGO_SIZE, touchAction: "none" }}
            onPointerDown={(e) => { e.preventDefault(); onInput({ targetId: mySlot.logo.id }); }}
          >
            <UnipalLogo size={LOGO_SIZE} />
          </button>
        )}

        {mySlot?.bomb && (
          <button
            key={mySlot.bomb.id}
            className="absolute p-0 border-none bg-transparent active:scale-110 transition-transform duration-75"
            style={{ left: mySlot.bomb.x, top: mySlot.bomb.y, width: LOGO_SIZE, height: LOGO_SIZE, touchAction: "none" }}
            onPointerDown={(e) => { e.preventDefault(); onInput({ targetId: mySlot.bomb!.id }); }}
          >
            <div
              className="w-full h-full flex items-center justify-center rounded-full bg-(--danger)/20 border-2 border-(--danger) animate-pulse"
              style={{ fontSize: LOGO_SIZE * 0.6 }}
            >
              💣
            </div>
          </button>
        )}
      </div>

      <p className="text-xs text-(--muted)">
        {mySlot?.bomb
          ? "Tap 💣 (−2 pts) or tap the logo to clear both!"
          : "Tap the logo (+1 pt) — avoid the 💣 bomb!"}
      </p>
    </div>
  );
}
