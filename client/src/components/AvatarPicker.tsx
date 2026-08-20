import { useRef } from "react";
import { Camera, User } from "lucide-react";
import Avatar from "@/components/Avatar";
import { AVATAR_ICON, type AvatarValue } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  value: AvatarValue;
  onChange: (value: AvatarValue) => void;
  onFile?: (file: File) => void;
  name: string;
  disabled?: boolean;
}

function AvatarPicker({
  value,
  onChange,
  onFile,
  name,
  disabled,
}: AvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file && onFile) onFile(file);
    event.target.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar
          name={name}
          image={value}
          className="size-20 text-2xl"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label="Use initials"
          title="Use initials"
          className={cn(
            "flex size-10 items-center justify-center rounded-full border-2 transition-colors",
            value === null
              ? "border-primary bg-primary/10"
              : "border-transparent bg-muted hover:border-border"
          )}
        >
          <span className="text-sm font-bold text-primary">
            {name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange(AVATAR_ICON)}
          disabled={disabled}
          aria-label="Use user icon"
          title="Use user icon"
          className={cn(
            "flex size-10 items-center justify-center rounded-full border-2 transition-colors",
            value === AVATAR_ICON
              ? "border-primary bg-primary/10"
              : "border-transparent bg-muted hover:border-border"
          )}
        >
          <User className="size-4 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Upload picture"
          title="Upload picture"
          className={cn(
            "flex size-10 items-center justify-center rounded-full border-2 transition-colors",
            value !== null && value !== AVATAR_ICON
              ? "border-primary bg-primary/10"
              : "border-transparent bg-muted hover:border-border"
          )}
        >
          <Camera className="size-4 text-muted-foreground" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Choose a profile picture"
          onChange={handleFileChange}
        />
      </div>

      {value !== null && value !== AVATAR_ICON && (
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Remove picture
        </button>
      )}
    </div>
  );
}

export { AvatarPicker };
