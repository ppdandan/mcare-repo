export type IconName =
  | "layout-dashboard" | "calendar" | "receipt" | "clock" | "users"
  | "clipboard" | "message" | "chart" | "file" | "settings" | "logout"
  | "check-circle" | "stethoscope" | "download" | "printer" | "list"
  | "shield-check" | "alert" | "info";

const paths: Record<IconName, string[]> = {
  "layout-dashboard": ["M3 3h7v7H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 14h7v7H3z"],
  calendar: ["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"],
  receipt: ["M4 2v20l3-2 3 2 3-2 3 2 4-2V2l-4 2-3-2-3 2-3-2z", "M8 8h8", "M8 12h8", "M8 16h5"],
  clock: ["M12 8v4l3 2", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M20 21v-2a4 4 0 0 0-3-3.87", "M17 3.13a4 4 0 0 1 0 7.75"],
  clipboard: ["M9 4h6", "M9 2h6v4H9z", "M7 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2", "M8 12h8", "M8 16h8"],
  message: ["M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"],
  chart: ["M3 3v18h18", "M18 17V9", "M13 17V5", "M8 17v-3"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h8"],
  settings: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.08-.02a1.7 1.7 0 0 0-1.75.56l-.06.07h-3.4l-.04-.08a1.7 1.7 0 0 0-1.48-1.02 1.7 1.7 0 0 0-1.48 1.02l-.04.08h-3.4l-.06-.07a1.7 1.7 0 0 0-1.75-.56l-.08.02-1.7-2.94.06-.06A1.7 1.7 0 0 0 3.2 15l-.08-.04v-3.4l.08-.04a1.7 1.7 0 0 0 .34-1.88l-.06-.06 1.7-2.94.08.02a1.7 1.7 0 0 0 1.75-.56l.06-.07h3.4l.04.08a1.7 1.7 0 0 0 1.48 1.02 1.7 1.7 0 0 0 1.48-1.02l.04-.08h3.4l.06.07a1.7 1.7 0 0 0 1.75.56l.08-.02 1.7 2.94-.06.06a1.7 1.7 0 0 0-.34 1.88l.08.04v3.4z"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  "check-circle": ["M22 11.1V12a10 10 0 1 1-5.9-9.1", "M22 4 12 14.01l-3-3"],
  stethoscope: ["M6 3v5a4 4 0 0 0 8 0V3", "M6 3H4", "M14 3h2", "M10 12v2a6 6 0 0 0 12 0v-1", "M19 10a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  printer: ["M6 9V2h12v7", "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 14h12v8H6z"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  "shield-check": ["M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z", "m9 12 2 2 4-4"],
  alert: ["M10.3 3.9 1.8 18.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
  info: ["M12 16v-4", "M12 8h.01", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"],
};

export default function Icon({ name, size = 18, className, ...props }: {
  name: IconName;
  size?: number;
  className?: string;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      {paths[name].map((d, index) => <path key={index} d={d} />)}
    </svg>
  );
}
