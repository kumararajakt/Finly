export interface DateRange {
  start: string;
  end: string;
}

export function monthRange(month: string): DateRange {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(year, monthIndex, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
