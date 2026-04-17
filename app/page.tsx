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
      <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0d0d2b]">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        <div className="aurora-blob aurora-blob-4" />
        <div className="aurora-blob aurora-blob-5" />
      </div>
      <main className="flex min-h-screen items-start justify-center px-4 pt-16">
        <div className="w-full max-w-3xl">
          <AppShell today={today} />
        </div>
      </main>
    </>
  );
}
