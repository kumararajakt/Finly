import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVATAR_ICON, initials } from "@/lib/avatar";

function Avatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  if (image === AVATAR_ICON) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground select-none",
          className
        )}
      >
        <User className="size-[0.6em]" />
      </span>
    );
  }
  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={cn("shrink-0 rounded-full object-cover select-none", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground select-none",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

export default Avatar;
