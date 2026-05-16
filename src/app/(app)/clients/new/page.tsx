import Link from "next/link";
import { NewClientUploader } from "./NewClientUploader";

export default function NewClientPage() {
  return (
    <div className="container-noxias py-10 max-w-3xl">
      <div className="mb-8">
        <Link
          href="/clients"
          className="text-small hover:underline"
          style={{ color: "rgba(255, 255, 255, 0.65)" }}
        >
          ← Retour aux clients
        </Link>
        <span className="divider-green block mb-3 mt-4" />
        <h1 className="text-h2">Nouveau client</h1>
        <p className="text-body-l mt-2" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
          Upload la matrice de prospection et la boîte à outils du client.
          Claude lit les docs et configure tout : pitch, personas, objections,
          briefings de préparation pour les commerciaux.
        </p>
      </div>

      <NewClientUploader />
    </div>
  );
}
