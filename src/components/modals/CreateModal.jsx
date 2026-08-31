import { X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
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
  const prefill = useAppStore((s) => s.createModalPrefill);
  const closeCreateModal = useAppStore((s) => s.closeCreateModal);
  // Switching type by hand drops any parent prefill — it belonged to the
  // card that opened the modal, not whatever the user clicked over to.
  const setType = (key) => useAppStore.setState({ createModalType: key, createModalPrefill: null });

  const renderForm = () => {
    switch (type) {
      case "project": return <ProjectForm onDone={closeCreateModal} prefill={prefill} />;
      case "product": return <ProductForm onDone={closeCreateModal} prefill={prefill} />;
      case "area": return <AreaForm onDone={closeCreateModal} />;
      case "csv": return <CsvImportForm />;
      case "task":
      default: return <TaskForm onDone={closeCreateModal} prefill={prefill} />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeCreateModal} label="Create new" panelClassName="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t.key}
              className={`text-xs px-2.5 py-1.5 rounded-full border border-border ${type === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
              onClick={() => setType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={closeCreateModal} aria-label="Close" className="shrink-0 -mr-1.5 -mt-1.5">
          <X className="w-4 h-4" />
        </Button>
      </div>
      {renderForm()}
    </Modal>
  );
}