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
    <>
      <div className="corner-wrap corner-wrap--tl" aria-hidden="true">
        <div className="cs-1" /><div className="cs-2" /><div className="cs-3" />
      </div>
      <div className="corner-wrap corner-wrap--tr" aria-hidden="true">
        <div className="cs-1" /><div className="cs-2" /><div className="cs-3" />
      </div>
      <div className="corner-wrap corner-wrap--bl" aria-hidden="true">
        <div className="cs-1" /><div className="cs-2" /><div className="cs-3" />
      </div>
      <div className="corner-wrap corner-wrap--br" aria-hidden="true">
        <div className="cs-1" /><div className="cs-2" /><div className="cs-3" />
      </div>

      <main className="relative z-10 flex min-h-screen items-start justify-center px-4 pt-16">
        <div className="w-full max-w-3xl">
          <AppShell today={today} />
        </div>
      </main>
    </>
  );
}
