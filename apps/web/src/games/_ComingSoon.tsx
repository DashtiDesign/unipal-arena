import { GameComponentProps } from "./types";

interface Props extends GameComponentProps {
  gameId: string;
}

/** Temporary stub rendered for games not yet implemented on the client. */
export default function ComingSoon({ gameId, publicState, remainingMs, onInput }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <p className="text-4xl">🚧</p>
      <p className="font-bold text-lg">{gameId}</p>
      <p className="text-base-content/60 text-sm">Coming soon — game UI not yet implemented.</p>
      <p className="badge badge-info">{Math.ceil(remainingMs / 1000)}s</p>
      <details className="text-xs text-base-content/40 max-w-xs break-all">
        <summary>state</summary>
        <pre>{JSON.stringify(publicState, null, 2)}</pre>
      </details>
      {/* Wire up a generic tap so tapping_speed / reaction games still work */}
      <button className="btn btn-primary btn-lg mt-4" onClick={() => onInput({ t: Date.now(), answer: 0, choice: "rock", idx: 0, cell: 0, guess: 50 })}>
        Tap
      </button>
    </div>
  );
}
