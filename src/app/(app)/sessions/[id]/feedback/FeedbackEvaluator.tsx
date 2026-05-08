"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function FeedbackEvaluator({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    void run();
    async function run() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/evaluate`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error ?? "L'évaluation n'a pas pu être générée.",
          );
        }
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }, [sessionId, router]);

  return (
    <div className="container-noxias py-10 max-w-2xl">
      <div className="mb-8">
        <span className="divider-green block mb-3" />
        <h1 className="text-h2">Restitution en cours...</h1>
      </div>

      <Card>
        {error ? (
          <div className="space-y-4">
            <p className="text-body" style={{ color: "var(--color-error)" }}>
              {error}
            </p>
            <Button onClick={() => location.reload()} variant="primary">
              Réessayer
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
            <p className="text-body" style={{ color: "var(--color-dark)" }}>
              Le coach analyse ton appel — quelques secondes...
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
