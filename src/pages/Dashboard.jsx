import { useState } from "react";
import { useAppStore } from "@/lib/store";
import AreaCard from "@/components/areas/AreaCard";
import AreaModal from "@/components/areas/AreaModal";
import CreateModal from "@/components/modals/CreateModal";

export default function Dashboard() {
  const areas = useAppStore((s) => s.areas);
  const products = useAppStore((s) => s.products);
  const [expandedArea, setExpandedArea] = useState(null);

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold mb-6">Areas of Responsibility</h1>
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))" }}
      >
        {areas.map((area) => (
          <AreaCard
            key={area.id}
            area={area}
            productCount={products.filter((p) => p.areaId === area.id).length}
            onExpand={() => setExpandedArea(area)}
            stakeholderIds={products.filter((p) => p.areaId === area.id).flatMap((p) => p.stakeholderIds)}
          />
        ))}
      </div>
      <CreateModal />
      {expandedArea && (
        <AreaModal area={expandedArea} onClose={() => setExpandedArea(null)} />
      )}
    </div>
  );
}