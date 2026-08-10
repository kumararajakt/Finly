let appTimeZone: string | undefined;

export function setAppTimeZone(timeZone: string | null | undefined): void {
  appTimeZone = timeZone ?? undefined;
}

export function getAppTimeZone(): string | undefined {
  return appTimeZone;
}

export function tzOption(): { timeZone: string } | Record<string, never> {
  return appTimeZone ? { timeZone: appTimeZone } : {};
}
