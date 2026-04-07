import AppShell from "@/components/AppShell";

function getFormattedDate(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  return formatter.format(now);
}

export default function Home() {
  const today = getFormattedDate();
  return (
    <main className="flex min-h-screen items-start justify-center bg-gradient-to-br from-emerald-100 to-teal-100 px-4 pt-16">
      <div className="w-full max-w-3xl">
        <AppShell today={today} />
      </div>
    </main>
  );
}
