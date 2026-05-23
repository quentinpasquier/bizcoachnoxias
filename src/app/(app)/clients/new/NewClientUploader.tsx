"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loader } from "@/components/Loader";
import { CoachAvatar } from "@/components/CoachAvatar";

export function NewClientUploader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fallbackName, setFallbackName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "uploading" | "extracting">("idle");

  function addFiles(list: FileList | null) {
    if (!list) return;
    const newOnes = Array.from(list).filter(
      (f) => !files.some((existing) => existing.name === f.name && existing.size === f.size),
    );
    setFiles((prev) => [...prev, ...newOnes]);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleSubmit() {
    if (files.length === 0) {
      setError("Ajoute au moins un document avant de créer le client.");
      return;
    }
    setError(null);
    setLoading(true);
    setStep("uploading");

    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    if (fallbackName.trim()) formData.append("name", fallbackName.trim());

    setStep("extracting");

    const res = await fetch("/api/clients/from-docs", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Création du client échouée.");
      setLoading(false);
      setStep("idle");
      return;
    }

    const data = await res.json();
    router.push(`/clients/${data.id}`);
    router.refresh();
  }

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const acceptedFormats = ".pdf,.docx,.csv,.txt,.md,.tsv";

  return (
    <div className="space-y-5">
      {/* Dropzone */}
      <Card>
        <div
          className="rounded-lg p-10 text-center cursor-pointer transition-colors"
          style={{
            background: loading
              ? "rgba(60, 200, 121, 0.08)"
              : "var(--color-lavender)",
            border: `2px dashed ${loading ? "var(--color-green)" : "rgba(52, 36, 75, 0.16)"}`,
          }}
          onClick={() => !loading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!loading) addFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedFormats}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          {!loading && (
            <>
              <p className="text-body-l mb-2" style={{ color: "#b495ff" }}>
                <b>Glisse-dépose</b> tes documents ici
              </p>
              <p className="text-small" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
                ou clique pour les sélectionner. PDF, DOCX, CSV, TXT, MD · 15 MB max par fichier
              </p>
              <p className="text-meta mt-4" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
                Idéal : matrice de prospection + boîte à outils du client
              </p>
            </>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-5">
              <CoachAvatar state="thinking" size={72} withHalo />
              <Loader
                size="lg"
                message={
                  step === "uploading"
                    ? "J'embarque tes documents..."
                    : "Je lis tout ça et je te prépare le client."
                }
                detail="20 à 40 secondes selon la taille. Promis, ça vaut le coup."
              />
            </div>
          )}
        </div>

        {/* Liste des fichiers ajoutés */}
        {files.length > 0 && !loading && (
          <div className="mt-5 space-y-2">
            <div
              className="text-meta uppercase tracking-widest"
              style={{ color: "rgba(255, 255, 255, 0.65)" }}
            >
              {files.length} fichier{files.length > 1 ? "s" : ""} prêt
              {files.length > 1 ? "s" : ""} ({Math.round(totalSize / 1024)} kB)
            </div>
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center justify-between gap-3 p-3 rounded-md"
                style={{
                  background: "rgba(244, 241, 248, 0.5)",
                  border: "1px solid rgba(139, 127, 163, 0.16)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="text-small font-medium truncate"
                    style={{ color: "#b495ff" }}
                  >
                    {f.name}
                  </div>
                  <div
                    className="text-meta"
                    style={{ color: "rgba(255, 255, 255, 0.65)" }}
                  >
                    {Math.round(f.size / 1024)} kB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(f.name)}
                  className="text-meta hover:underline"
                  style={{ color: "var(--color-red)" }}
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Nom de fallback */}
      <Card>
        <Input
          id="fallbackName"
          label="Nom du client (optionnel)"
          placeholder="DOKO, Cabinet Mercier, Studio Octant..."
          hint="Si le cerveau IA n'arrive pas à le déduire des docs, on utilisera ce nom."
          value={fallbackName}
          onChange={(e) => setFallbackName(e.target.value)}
          disabled={loading}
        />
      </Card>

      {error && (
        <div
          className="rounded-md px-4 py-3 text-small"
          style={{
            background: "rgba(233, 75, 75, 0.08)",
            color: "var(--color-error)",
            border: "1px solid rgba(233, 75, 75, 0.24)",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/clients")}
          disabled={loading}
        >
          Annuler
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          loading={loading}
          disabled={files.length === 0}
        >
          {loading ? "Configuration en cours..." : "Créer et configurer →"}
        </Button>
      </div>
    </div>
  );
}
