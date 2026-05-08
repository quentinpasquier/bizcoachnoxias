import Link from "next/link";
import { ClientForm } from "../ClientForm";

export default function NewClientPage() {
  return (
    <div className="container-noxias py-10 max-w-3xl">
      <div className="mb-8">
        <Link
          href="/clients"
          className="text-small hover:underline"
          style={{ color: "var(--color-gray)" }}
        >
          ← Retour aux clients
        </Link>
        <span className="divider-green block mb-3 mt-4" />
        <h1 className="text-h2">Nouveau client</h1>
        <p className="text-body mt-1" style={{ color: "var(--color-gray)" }}>
          Décris l'offre du client pour que les commerciaux puissent simuler la prospection.
        </p>
      </div>

      <ClientForm />
    </div>
  );
}
