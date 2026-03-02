import { GameComponentProps } from "./types";
import { Button, Chip } from "@heroui/react";

interface Props extends GameComponentProps {
  gameId: string;
}

export default function ComingSoon({ gameId, publicState, remainingMs, onInput }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <p className="text-4xl">🚧</p>
      <p className="font-bold text-lg">{gameId}</p>
      <p className="text-(--muted) text-sm">Coming soon — game UI not yet implemented.</p>
      <Chip size="sm" color="accent" variant="soft">{Math.ceil(remainingMs / 1000)}s</Chip>
      <details className="text-xs text-(--muted) max-w-xs break-all">
        <summary>state</summary>
        <pre>{JSON.stringify(publicState, null, 2)}</pre>
      </details>
      <Button variant="primary" size="lg" onPress={() => onInput({ t: Date.now(), answer: 0, choice: "rock", idx: 0, cell: 0, guess: 50 })}>
        Tap
      </Button>
    </div>
  );
}
