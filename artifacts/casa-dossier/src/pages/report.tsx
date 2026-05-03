import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { ShieldCheck, Wrench, FileText, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ServiceRecord = {
  id: string;
  date: string;
  description: string;
  technicianName: string | null;
  companyName: string | null;
  verified: boolean;
};

type ReportAsset = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  status: string;
  retiredAt: string | null;
  notes: string | null;
  records: ServiceRecord[];
};

type ReportData = {
  property: {
    name: string;
    address: string;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    yearBuilt: number | null;
    sqft: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
  };
  activeAssets: ReportAsset[];
  retiredAssets: ReportAsset[];
  totalEvents: number;
  generatedAt: string;
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function TechSpec({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="border-l border-gray-800 first:border-l-0 pl-6 first:pl-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function AssetBlock({ asset, retired = false }: { asset: ReportAsset; retired?: boolean }) {
  const performer = (r: ServiceRecord) =>
    r.companyName ?? r.technicianName ?? "Homeowner (DIY)";

  return (
    <div
      className="mb-6 border border-gray-300 rounded"
      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
    >
      {/* Asset header */}
      <div className={`flex items-start justify-between gap-4 px-4 py-3 ${retired ? "bg-gray-100" : "bg-gray-50"} border-b border-gray-300 rounded-t`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">{asset.category}</p>
          <p className="font-bold text-gray-900 text-sm mt-0.5">{asset.name}</p>
          {(asset.brand || asset.model) && (
            <p className="text-xs text-gray-500 mt-0.5">{[asset.brand, asset.model].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {retired && asset.retiredAt && (
            <span className="inline-flex items-center gap-1 bg-gray-800 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
              DECOMMISSIONED {fmtDate(asset.retiredAt)}
            </span>
          )}
          {(asset.installDate || asset.serialNumber) && (
            <div className="bg-gray-900 text-white text-[9px] px-2 py-1 rounded flex items-center gap-2 font-mono">
              {asset.installDate && <span>MFR: {asset.installDate}</span>}
              {asset.installDate && asset.serialNumber && <span className="opacity-40">|</span>}
              {asset.serialNumber && <span>S/N: {asset.serialNumber}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Service history */}
      {asset.records.length > 0 ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="text-left px-4 py-1.5 text-[9px] uppercase tracking-widest font-bold text-gray-400 w-24">Date</th>
              <th className="text-left px-4 py-1.5 text-[9px] uppercase tracking-widest font-bold text-gray-400">Service Item</th>
              <th className="text-left px-4 py-1.5 text-[9px] uppercase tracking-widest font-bold text-gray-400 w-36">Performer</th>
            </tr>
          </thead>
          <tbody>
            {asset.records.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-2 text-gray-500 whitespace-nowrap font-mono text-[10px]">{fmtDate(r.date)}</td>
                <td className="px-4 py-2 text-gray-800">{r.description}</td>
                <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{performer(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-4 py-3 text-xs text-gray-400 italic">No service events recorded.</p>
      )}

      {asset.notes && (
        <div className="px-4 py-2 border-t border-gray-200 bg-amber-50">
          <p className="text-[10px] text-amber-800"><span className="font-bold uppercase tracking-wide">Notes:</span> {asset.notes}</p>
        </div>
      )}
    </div>
  );
}

export default function PropertyReport() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/properties/${id}/report`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load report");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (data) {
      document.title = `Property Dossier – ${data.property.address}`;
    }
  }, [data]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        Error: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Generating your Official Property Dossier…</p>
      </div>
    );
  }

  const { property, activeAssets, retiredAssets, totalEvents, generatedAt } = data;
  const fullAddress = [property.address, property.city, property.state, property.zipCode].filter(Boolean).join(", ");
  const config = [
    property.bedrooms ? `${property.bedrooms} BD` : null,
    property.bathrooms ? `${property.bathrooms} BA` : null,
  ].filter(Boolean).join(" / ") || null;

  return (
    <>
      {/* Print trigger bar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-50 flex items-center justify-between gap-4 bg-gray-900 text-white px-6 py-3">
        <div>
          <p className="font-bold text-sm">Official Property Dossier</p>
          <p className="text-xs text-gray-400">{fullAddress}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-white text-gray-900 text-sm font-bold px-4 py-2 rounded hover:bg-gray-100 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Print / Save PDF
        </button>
      </div>

      {/* Report document */}
      <div className="bg-white min-h-screen">
        <div className="max-w-4xl mx-auto px-8 py-10 print:px-0 print:py-0">

          {/* ── 1. Document Header ── */}
          <div className="flex items-start justify-between border-b-2 border-gray-900 pb-5 mb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2">Official Property Dossier</p>
              <h1 className="text-3xl font-black text-gray-900 leading-tight tracking-tight">{property.address}</h1>
              {(property.city || property.state) && (
                <p className="text-sm text-gray-500 mt-1">{[property.city, property.state, property.zipCode].filter(Boolean).join(", ")}</p>
              )}
            </div>
            <div
              className="flex flex-col items-center border-4 border-gray-900 px-4 py-2 rounded shrink-0"
              style={{ boxShadow: "3px 3px 0 #111" }}
            >
              <ShieldCheck className="h-7 w-7 text-gray-900 mb-1" />
              <p className="font-black text-xs uppercase tracking-widest text-gray-900">Verified</p>
              <p className="font-mono text-[8px] text-gray-500 mt-0.5">Casa Dossier</p>
            </div>
          </div>

          {/* ── 2. Technical Specifications Strip ── */}
          <div className="flex gap-0 border border-gray-300 rounded mb-8 overflow-hidden">
            {[
              { label: "Built", value: property.yearBuilt },
              { label: "Structure", value: property.sqft ? `${property.sqft.toLocaleString()} sqft` : null },
              { label: "Configuration", value: config },
              { label: "Registry", value: `${totalEvents} Audited Events` },
            ].map((spec, i) => (
              spec.value != null ? (
                <div key={i} className="flex-1 px-5 py-3 border-l border-gray-300 first:border-l-0 bg-gray-50">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-500">{spec.label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{spec.value}</p>
                </div>
              ) : null
            ))}
          </div>

          {/* ── 3. Active Inventory ── */}
          {activeAssets.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gray-900" />
                <h2 className="font-black text-xs uppercase tracking-[0.2em] text-gray-900 px-2">Current Operational Inventory</h2>
                <div className="h-px flex-1 bg-gray-900" />
              </div>
              {activeAssets.map((a) => <AssetBlock key={a.id} asset={a} />)}
            </section>
          )}

          {/* ── 4. Decommissioned Archive ── */}
          {retiredAssets.length > 0 && (
            <section className="mb-10" style={{ opacity: 0.7 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gray-500" />
                <h2 className="font-black text-xs uppercase tracking-[0.2em] text-gray-500 px-2">Property Systems Archive</h2>
                <div className="h-px flex-1 bg-gray-500" />
              </div>
              <p className="text-[10px] text-gray-400 italic mb-4">
                Decommissioned systems are preserved below to demonstrate the continuous chain of care for this property.
              </p>
              {retiredAssets.map((a) => <AssetBlock key={a.id} asset={a} retired />)}
            </section>
          )}

          {/* ── 5. Authentication Footer ── */}
          <div className="border-t-2 border-gray-900 pt-5 mt-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-mono text-gray-500">
                  Report generated: {format(parseISO(generatedAt), "MMMM d, yyyy 'at' h:mm a")}
                </p>
                <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                  Property: {fullAddress}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {[
                  { icon: Wrench, label: "Technical Specification" },
                  { icon: ShieldCheck, label: "Verified Logic" },
                  { icon: FileText, label: "Chain of Custody" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 text-center">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[9px] text-gray-300 font-mono mt-3">
              This document was generated via the Casa Dossier Protocol. All service data reflects events recorded by the homeowner or verified third parties.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
