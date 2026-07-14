import { useState, useRef, useEffect } from "react";
import { Check, Plus } from "lucide-react";

export default function StakeholderAssigner({ 
  currentStakeholderIds = [], 
  allStakeholders = [], 
  onSave 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleStakeholder = (id) => {
    const newIds = currentStakeholderIds.includes(id)
      ? currentStakeholderIds.filter((existingId) => existingId !== id)
      : [...currentStakeholderIds, id];
    
    onSave(newIds);
  };

  // Safe subset for rendering the mini-avatars
  const assigned = allStakeholders.filter(s => currentStakeholderIds.includes(s.id));

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* TRIGGER: The Avatar Stack (or a Plus button if empty) */}
      <div 
        className="flex items-center cursor-pointer hover:opacity-80 transition-opacity min-h-[24px] min-w-[24px]" 
        onClick={() => setIsOpen(!isOpen)}
        title="Assign Stakeholders"
      >
        {assigned.length === 0 ? (
          <div className="w-6 h-6 rounded-full bg-secondary border border-dashed border-border flex items-center justify-center text-muted-foreground">
            <Plus className="w-3 h-3" />
          </div>
        ) : (
          <div className="flex pl-2">
            {assigned.slice(0, 5).map((s, i) => (
              <div key={s.id} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold shadow-sm" style={{ marginLeft: '-10px', zIndex: 10 - i }}>
                {s.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {assigned.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold" style={{ marginLeft: '-10px', zIndex: 0 }}>
                +{assigned.length - 5}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div className="absolute top-full mt-1 left-0 w-48 max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-xl z-50 p-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5 border-b border-border mb-1">
            Assign Stakeholders
          </p>
          {allStakeholders.map((s) => {
            const isAssigned = currentStakeholderIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleStakeholder(s.id)}
                className="w-full text-left px-2 py-1.5 text-xs flex items-center justify-between hover:bg-secondary rounded-sm transition-colors"
              >
                <span>{s.name} <span className="text-[10px] text-muted-foreground ml-1">({s.department})</span></span>
                {isAssigned && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}