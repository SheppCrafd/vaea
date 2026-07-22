import Portal from "@/lib/Portal";
import { X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import TaskForm from "@/components/modals/TaskForm";
import ProjectForm from "@/components/modals/ProjectForm";
import ProductForm from "@/components/modals/ProductForm";
import AreaForm from "@/components/modals/AreaForm";
import CsvImportForm from "@/components/modals/CsvImportForm";

const TYPES = [
  { key: "task", label: "Task" },
  { key: "project", label: "Project" },
  { key: "product", label: "Product" },
  { key: "area", label: "Area" },
  { key: "csv", label: "Via .csv" },
];

// Polymorphic create modal — switches between the four object forms based on createModalType.
export default function CreateModal() {
  const isOpen = useAppStore((s) => s.isCreateModalOpen);
  const type = useAppStore((s) => s.createModalType);
  const closeCreateModal = useAppStore((s) => s.closeCreateModal);
  const setType = useAppStore.setState;

  if (!isOpen) return null;

  const renderForm = () => {
    switch (type) {
      case "project": return <ProjectForm onDone={closeCreateModal} />;
      case "product": return <ProductForm onDone={closeCreateModal} />;
      case "area": return <AreaForm onDone={closeCreateModal} />;
      case "csv": return <CsvImportForm />;
      case "task":
      default: return <TaskForm onDone={closeCreateModal} />;
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeCreateModal}>
        <div
          className="bg-card rounded-xl shadow-xl w-full max-w-md p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1.5 flex-wrap">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  className={`text-xs px-2.5 py-1 rounded-full border border-border ${type === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  onClick={() => setType({ createModalType: t.key })}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={closeCreateModal}>
              <X className="w-4 h-4" />
            </button>
          </div>
          {renderForm()}
        </div>
      </div>
    </Portal>
  );
}