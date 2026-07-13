import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/lib/store";
import { useHighlight } from "@/lib/HighlightContext";
import CanvasAvatar from "@/components/sidebar/CanvasAvatar";

// Stakeholders grouped by department in an accordion; checkboxes toggle the
// global highlight context used to dim non-relevant cards across the app.
export default function StakeholderList() {
  const stakeholders = useAppStore((s) => s.stakeholders);
  const { highlightedIds, toggleHighlight } = useHighlight();
  const departments = [...new Set(stakeholders.map((s) => s.department))];

  return (
    <Accordion type="multiple" className="w-full">
      {departments.map((dept) => (
        <AccordionItem key={dept} value={dept}>
          <AccordionTrigger className="text-sm">{dept}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {stakeholders.filter((s) => s.department === dept).map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={highlightedIds.includes(s.id)}
                    onCheckedChange={() => toggleHighlight(s.id)}
                  />
                  <CanvasAvatar name={s.name} avatarUrl={s.avatarUrl} />
                  <span className="text-xs">{s.name}</span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}