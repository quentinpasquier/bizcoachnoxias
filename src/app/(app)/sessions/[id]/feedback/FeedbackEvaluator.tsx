"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/Loader";
import { CoachAvatar } from "@/components/CoachAvatar";

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
      <Card className="py-14">
        {error ? (
          <div className="text-center space-y-4">
            <p className="text-body" style={{ color: "var(--color-error)" }}>
              {error}
            </p>
            <Button onClick={() => location.reload()} variant="primary">
              Réessayer
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-6">
            <CoachAvatar state="thinking" size={96} withHalo />
            <div>
              <div className="eyebrow-green mb-2">Coach Noxias</div>
              <h1 className="text-h2">Je débriefe ton appel.</h1>
              <p
                className="text-body mt-3"
                style={{ color: "var(--color-gray)" }}
              >
                J&apos;écoute, je note, je décortique. Quelques secondes.
              </p>
            </div>
            <Loader size="md" />
          </div>
        )}
      </Card>
    </div>
  );
}
