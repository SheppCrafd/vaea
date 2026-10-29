import { Link } from "react-router";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

// Header settings entry point. There's no account/login concept in this
// self-owned build, so this is just a link to Settings rather than a
// user-identity dropdown.
export default function UserMenu() {
  return (
    <Button variant="outline" size="icon" asChild aria-label="Settings">
      <Link to="/app/settings">
        <Settings className="w-4 h-4" />
      </Link>
    </Button>
  );
}
