import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export default function ThemeToggle() {
  const { resolved, mode, setMode } = useTheme();

  const nextMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
  const icon = resolved === "dark" ? <Sun /> : <Moon />;
  const title = 
    mode === "system" 
      ? `System (${resolved}) — click to cycle`
      : mode === "light"
      ? "Light mode — click to cycle"
      : "Dark mode — click to cycle";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setMode(nextMode)}
      aria-label={title}
      title={title}
      className={cn(mode === "system" && "text-muted-foreground")}
    >
      {mode === "system" ? <Monitor /> : icon}
    </Button>
  );
}
