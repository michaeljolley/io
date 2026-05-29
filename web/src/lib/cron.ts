const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseCronField(spec: string, min: number, max: number): number[] {
  const values = new Set<number>();

  if (spec === "*") {
    for (let i = min; i <= max; i += 1) values.add(i);
    return Array.from(values);
  }

  if (spec.startsWith("*/")) {
    const step = Number.parseInt(spec.slice(2), 10);
    if (Number.isNaN(step) || step <= 0) return [];
    for (let i = min; i <= max; i += step) values.add(i);
    return Array.from(values);
  }

  const parsedSegments = spec.split(",").map((segment) => segment.trim()).filter(Boolean);
  for (const segment of parsedSegments) {
    if (segment.includes("-")) {
      const [startRaw, endRaw] = segment.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      for (let i = Math.min(start, end); i <= Math.max(start, end); i += 1) {
        if (i >= min && i <= max) values.add(i);
      }
      continue;
    }

    const exact = Number.parseInt(segment, 10);
    if (!Number.isNaN(exact) && exact >= min && exact <= max) values.add(exact);
  }

  return Array.from(values);
}

function formatTime(hourValue: number, minuteValue: number): string {
  const hour12 = ((hourValue + 11) % 12) + 1;
  const amPm = hourValue < 12 ? "AM" : "PM";
  const minute = minuteValue.toString().padStart(2, "0");

  return `${hour12}:${minute} ${amPm}`;
}

function formatDayList(values: number[], labels: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return labels[values[0]];

  const mapped = values.map((value) => labels[value]);
  if (mapped.length === 2) return `${mapped[0]} and ${mapped[1]}`;

  return `${mapped.slice(0, -1).join(", ")}, and ${mapped[mapped.length - 1]}`;
}

function describeDayOfWeek(spec: string): string {
  const values = parseCronField(spec, 0, 6);
  if (values.length === 0) return "";

  const normalized = values.map((value) => (value === 7 ? 0 : value));
  const sorted = Array.from(new Set(normalized)).sort((a, b) => a - b);

  if (sorted.length === 7) return "every day";

  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];
  const weekdaysMatch = weekdays.every((day) => sorted.includes(day)) && sorted.length === weekdays.length;
  const weekendMatch = weekend.every((day) => sorted.includes(day)) && sorted.length === weekend.length;

  if (weekdaysMatch) return "weekdays";
  if (weekendMatch) return "weekends";

  return formatDayList(sorted, DAY_NAMES);
}

function describeMonth(spec: string): string {
  const values = parseCronField(spec, 1, 12);
  if (values.length === 0) return "";
  if (values.length === 12) return "";
  return formatDayList(values.map((value) => value - 1), MONTH_NAMES);
}

function describeDayOfMonth(spec: string): string {
  const values = parseCronField(spec, 1, 31);
  if (values.length === 0) return "";
  if (values.length === 31) return "";

  const ordinals = values.map((value) => {
    const suffix = [11, 12, 13].includes(value) ? "th" : [1, 21, 31].includes(value) ? "st" : [2, 22].includes(value) ? "nd" : [3, 23].includes(value) ? "rd" : "th";
    return `${value}${suffix}`;
  });

  if (ordinals.length === 1) return `on the ${ordinals[0]} of the month`;

  return `on the ${ordinals.join(", ")}`;
}

function describeTime(minuteSpec: string, hourSpec: string): string {
  const minuteValues = parseCronField(minuteSpec, 0, 59);
  const hourValues = parseCronField(hourSpec, 0, 23);

  if (minuteValues.length === 0 || hourValues.length === 0) return "custom times";

  if (minuteSpec === "*" && hourSpec === "*") return "every minute";
  if (minuteSpec === "*" && hourSpec.startsWith("*/")) {
    const step = Number.parseInt(hourSpec.slice(2), 10);
    if (!Number.isNaN(step) && step > 0) return `every ${step} hours`;
  }
  if (minuteSpec.startsWith("*/") && hourSpec === "*") {
    const step = Number.parseInt(minuteSpec.slice(2), 10);
    if (!Number.isNaN(step) && step > 0) return `every ${step} minutes`;
  }
  if (minuteSpec === "*" && hourValues.length === 24) return "every hour";
  if (minuteSpec === "*" && hourValues.length === 1) return `once each hour at ${formatTime(hourValues[0], 0)}`;

  if (minuteValues.length === 1 && hourValues.length === 1) {
    return `at ${formatTime(hourValues[0], minuteValues[0])}`;
  }

  if (minuteValues.length > 1 && hourValues.length === 1) {
    return `at ${minuteValues.map((minute) => formatTime(hourValues[0], minute)).join(", ")}`;
  }

  if (hourValues.length > 1 && minuteValues.length === 1) {
    return `at ${hourValues.map((hour) => formatTime(hour, minuteValues[0])).join(", ")}`;
  }

  return "at matching times";
}

export function describeCronExpression(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "custom schedule";

  const [minuteSpec, hourSpec, dayOfMonthSpec, monthSpec, dayOfWeekSpec] = parts;
  const timePart = describeTime(minuteSpec, hourSpec);
  const dayOfWeekPart = describeDayOfWeek(dayOfWeekSpec);
  const dayOfMonthPart = describeDayOfMonth(dayOfMonthSpec);
  const monthPart = describeMonth(monthSpec);

  if (timePart === "every minute") return "every minute";

  const dayDescriptor = dayOfWeekSpec !== "*" && dayOfMonthSpec === "*"
    ? `on ${dayOfWeekPart}`
    : dayOfMonthSpec !== "*" && dayOfWeekSpec === "*"
      ? dayOfMonthPart
      : dayOfWeekSpec === "*" && dayOfMonthSpec === "*"
        ? "each day"
        : "on matching days";

  const fragments = [timePart, dayDescriptor].filter((fragment) => fragment && fragment !== "custom times" && fragment !== "at matching times");
  if (monthPart) fragments.push(`in ${monthPart}`);

  if (fragments.length === 0) return "custom schedule";

  return fragments.join(" ");
}
