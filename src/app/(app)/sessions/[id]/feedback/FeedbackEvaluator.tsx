"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/Loader";

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
            data.error ?? "Le débrief n'a pas pu être généré.",
          );
        }
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }, [sessionId, router]);

  return (
    <div className="container-noxias py-16 max-w-2xl">
      <div className="mb-8 text-center">
        <span className="eyebrow-green block mb-3">Coach Noxias</span>
        <h1 className="text-h2">Je débriefe ton appel.</h1>
      </div>

      <Card className="py-12">
        {error ? (
          <div className="space-y-4 text-center">
            <p className="text-body" style={{ color: "var(--color-error)" }}>
              {error}
            </p>
            <Button onClick={() => location.reload()} variant="primary">
              Réessayer
            </Button>
          </div>
        ) : (
          <Loader
            size="lg"
            message="J'écoute, je note, je décortique..."
            detail="Quelques secondes, je te prépare un débrief carré."
          />
        )}
      </Card>
    </div>
  );
}
