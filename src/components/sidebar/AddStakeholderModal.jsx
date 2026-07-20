import { useState, useRef } from "react";
import { X } from "lucide-react";
import Portal from "@/lib/Portal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateStakeholder } from "@/hooks/useStakeholders";
import { useDepartments, useCreateDepartment } from "@/hooks/useDepartments";
import { useFileUpload } from "@/hooks/useFileUpload";

const NEW_DEPARTMENT = "__new__";

export default function AddStakeholderModal({ onClose }) {
  const { data: departments = [] } = useDepartments();
  const createDepartment = useCreateDepartment();
  const createStakeholder = useCreateStakeholder();
  const { upload } = useFileUpload();

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);

  const isCreatingDepartment = department === NEW_DEPARTMENT;
  const resolvedDepartmentName = isCreatingDepartment ? newDepartmentName.trim() : department;

  // Doesn't close after a successful add — lets the user keep adding
  // stakeholders consecutively without reopening the modal each time. They
  // close it explicitly (X / overlay click) once they're done.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !resolvedDepartmentName) return;

    if (isCreatingDepartment) {
      await createDepartment.mutateAsync({ name: resolvedDepartmentName });
    }

    let avatar_url;
    if (file) {
      avatar_url = await upload(file);
    }
    createStakeholder.mutate({ name, department: resolvedDepartmentName, avatar_url });

    setName("");
    setDepartment(isCreatingDepartment ? resolvedDepartmentName : department);
    setNewDepartmentName("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    nameInputRef.current?.focus();
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold">Add Stakeholder</h3>
            <button onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Name</label>
              <Input ref={nameInputRef} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
              >
                <option value="">Select a department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
                <option value={NEW_DEPARTMENT}>+ New department...</option>
              </select>
              {isCreatingDepartment && (
                <Input
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="New department name"
                  className="mt-2"
                  autoFocus
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Image (optional)</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs" />
            </div>
            <Button type="submit" className="w-full" disabled={!name.trim() || !resolvedDepartmentName}>
              Add Stakeholder
            </Button>
          </form>
        </div>
      </div>
    </Portal>
  );
}
