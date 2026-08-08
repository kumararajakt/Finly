import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const { logout } = useAuth();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Set up net worth, categories, tags, and accounts here.
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-medium">Account</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign out of this device. You will need your password to get back in.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => void logout()}>
          <LogOut />
          Log out
        </Button>
      </section>
    </div>
  );
}
