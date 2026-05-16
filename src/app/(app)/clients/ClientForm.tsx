"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Client, SyncedFile } from "@/lib/supabase/types";

interface Props {
  initial?: Client;
}

export function ClientForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [sector, setSector] = useState(initial?.sector ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [valueProp, setValueProp] = useState(initial?.value_proposition ?? "");
  const [productPitch, setProductPitch] = useState(initial?.product_pitch ?? "");
  const [idealTargets, setIdealTargets] = useState(initial?.ideal_targets ?? "");
  const [targetPersonasRaw, setTargetPersonasRaw] = useState(
    (initial?.target_personas ?? []).join("\n"),
  );
  const [objectionsRaw, setObjectionsRaw] = useState(
    initial?.typical_objections?.join("\n") ?? "",
  );
  const [active, setActive] = useState(initial?.active ?? true);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!name.trim()) return setError("Le nom du client est obligatoire.");
    if (!productPitch.trim() && !initial?.synced_content)
      return setError("Le pitch est obligatoire (peut être extrait des docs uploadés).");

    setLoading(true);

    const payload = {
      name: name.trim(),
      sector: sector.trim() || null,
      description: description.trim() || null,
      value_proposition: valueProp.trim() || null,
      product_pitch: productPitch.trim() || "(extraira depuis les docs)",
      ideal_targets: idealTargets.trim() || null,
      target_personas: targetPersonasRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      typical_objections: objectionsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      active,
    };

    const url = isEdit ? `/api/clients/${initial!.id}` : "/api/clients";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    router.push(isEdit ? `/clients/${initial!.id}` : `/clients/${data.id}`);
    router.refresh();
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!initial) {
      setError("Enregistre d'abord le client (au moins le nom), puis upload les docs.");
      return;
    }

    setError(null);
    setInfo(null);
    setUploading(true);

    const formData = new FormData();
    for (const f of Array.from(files)) {
      formData.append("files", f);
    }

    const res = await fetch(`/api/clients/${initial.id}/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Upload échoué.");
      setUploading(false);
      return;
    }

    const failures = data.parsed?.filter((p: { error?: string }) => p.error) ?? [];
    const baseMessage = `${data.parsed.length} fichier(s) traité(s), ${data.contentLength.toLocaleString("fr-FR")} caractères au total.`;
    const extractMessage = data.extracted
      ? " Personas, objections, pitch et value prop extraits automatiquement."
      : data.extractionError
        ? ` (Extraction Claude échouée : ${data.extractionError})`
        : "";
    const failureMessage = failures.length > 0
      ? ` ⚠️ ${failures.length} échec(s) : ${failures.map((f: { filename: string; error: string }) => `${f.filename} (${f.error})`).join(", ")}`
      : "";

    setInfo(baseMessage + extractMessage + failureMessage);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  async function handleDeleteFile(filename: string) {
    if (!initial) return;
    if (!confirm(`Retirer « ${filename} » de ce client ?`)) return;

    const res = await fetch(
      `/api/clients/${initial.id}/upload?filename=${encodeURIComponent(filename)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Suppression impossible.");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!initial) return;
    if (
      !confirm(
        `Supprimer définitivement « ${initial.name} » ? Les sessions passées seront conservées mais le client disparaîtra des listes.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/clients/${initial.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Suppression impossible.");
      setDeleting(false);
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  const syncedFiles = initial?.synced_files ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bloc Upload Docs */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-h4">Docs de prospection (matrice + boîte à outils)</h3>
          {initial?.synced_at && (
            <span className="badge" style={{ background: "rgba(60, 200, 121, 0.18)", color: "#1F6A3F" }}>
              {syncedFiles.length} fichier{syncedFiles.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-small mb-4" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
          Upload la matrice de prospection et la boîte à outils du client (PDF, DOCX, CSV, TXT, MD).
          Claude extrait automatiquement personas, objections, pitch et value prop. Le contenu sert
          de référence pour générer les scénarios à chaque session.
        </p>

        {!isEdit && (
          <p
            className="text-small p-3 rounded-md"
            style={{
              background: "rgba(245, 165, 36, 0.12)",
              color: "#8A5A0E",
              border: "1px solid rgba(245, 165, 36, 0.32)",
            }}
          >
            Crée d'abord le client (au moins son nom), tu pourras uploader les docs ensuite depuis sa fiche.
          </p>
        )}

        {isEdit && (
          <>
            <div
              className="rounded-lg p-6 text-center cursor-pointer transition-colors"
              style={{
                background: uploading
                  ? "rgba(60, 200, 121, 0.08)"
                  : "var(--color-lavender)",
                border: `2px dashed ${uploading ? "var(--color-green)" : "rgba(52, 36, 75, 0.16)"}`,
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleUploadFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.csv,.txt,.md,.tsv"
                className="hidden"
                onChange={(e) => handleUploadFiles(e.target.files)}
              />
              {uploading ? (
                <p className="text-body" style={{ color: "var(--color-green)" }}>
                  Upload + parsing + extraction Claude en cours...
                </p>
              ) : (
                <>
                  <p className="text-body" style={{ color: "#b495ff" }}>
                    <b>Glisse-dépose</b> ou clique pour sélectionner des fichiers
                  </p>
                  <p
                    className="text-meta mt-2"
                    style={{ color: "rgba(255, 255, 255, 0.65)" }}
                  >
                    PDF, DOCX, CSV, TXT, MD · max 15 MB par fichier
                  </p>
                </>
              )}
            </div>

            {syncedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div
                  className="text-meta uppercase tracking-widest"
                  style={{ color: "rgba(255, 255, 255, 0.65)" }}
                >
                  Fichiers actuels
                </div>
                {syncedFiles.map((f: SyncedFile) => (
                  <div
                    key={f.filename}
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
                        {f.filename}
                      </div>
                      <div
                        className="text-meta"
                        style={{ color: "rgba(255, 255, 255, 0.65)" }}
                      >
                        {f.kind.toUpperCase()} · {Math.round(f.size / 1024)} kB ·{" "}
                        {f.char_count.toLocaleString("fr-FR")} caractères ·{" "}
                        {new Date(f.uploaded_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(f.filename)}
                      className="text-meta hover:underline"
                      style={{ color: "var(--color-red)" }}
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Bloc Identité */}
      <Card className="space-y-5">
        <h3 className="text-h4">Identité du client</h3>

        <Input
          id="name"
          label="Nom du client *"
          placeholder="DOKO"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          id="sector"
          label="Secteur"
          placeholder="Agence marketing digital, Conseil RH, SaaS..."
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        />

        <Textarea
          id="description"
          label="Description"
          rows={2}
          placeholder="Agence Lyonnaise SEO/SEA pour avocats et escape games."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Card>

      {/* Bloc Champs structurés */}
      <Card className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-h4">Pitch et personas</h3>
          {initial?.synced_at && (
            <span
              className="text-meta"
              style={{ color: "rgba(255, 255, 255, 0.65)" }}
            >
              Auto-extraits depuis les docs · modifiables ici
            </span>
          )}
        </div>

        <Textarea
          id="valueProp"
          label="Value proposition"
          rows={2}
          placeholder="ROI local rapide et transparent grâce au couplage SEA + SEO."
          value={valueProp}
          onChange={(e) => setValueProp(e.target.value)}
        />

        <Textarea
          id="productPitch"
          label="Pitch à porter en RDV"
          rows={3}
          placeholder="Pilotage humain de campagnes Google Ads et SEO local pour faire chuter le coût d'acquisition."
          value={productPitch}
          onChange={(e) => setProductPitch(e.target.value)}
        />

        <Textarea
          id="targetPersonas"
          label="Personas cibles (un par ligne)"
          rows={3}
          placeholder={`Avocat\nGérant Escape Game`}
          hint="Le commercial choisit quel persona entraîner avant chaque session."
          value={targetPersonasRaw}
          onChange={(e) => setTargetPersonasRaw(e.target.value)}
        />

        <Input
          id="idealTargets"
          label="Cibles idéales"
          placeholder="DG cabinets, gérants escape games..."
          value={idealTargets}
          onChange={(e) => setIdealTargets(e.target.value)}
        />

        <Textarea
          id="objections"
          label="Objections classiques (une par ligne)"
          rows={6}
          placeholder={`J'ai déjà une agence et j'en suis satisfait\nPas de budget pour ça\nGoogle Ads est un gouffre financier`}
          hint="L'IA peut les ressortir naturellement pendant l'appel."
          value={objectionsRaw}
          onChange={(e) => setObjectionsRaw(e.target.value)}
        />

        <div className="flex items-center gap-3 pt-2 border-t border-[rgba(139,127,163,0.16)]">
          <input
            id="active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-5 h-5 rounded accent-[var(--color-green)]"
          />
          <label htmlFor="active" className="text-small">
            Client actif (visible dans les listes de sélection)
          </label>
        </div>
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

      {info && (
        <div
          className="rounded-md px-4 py-3 text-small"
          style={{
            background: "rgba(60, 200, 121, 0.10)",
            color: "#1F6A3F",
            border: "1px solid rgba(60, 200, 121, 0.32)",
          }}
        >
          {info}
        </div>
      )}

      <div className="flex justify-between flex-wrap gap-3">
        <div>
          {isEdit && (
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              Supprimer
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {isEdit ? "Enregistrer" : "Créer le client"}
          </Button>
        </div>
      </div>
    </form>
  );
}
