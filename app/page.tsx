import LogForm from "@/components/LogForm";

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
    <main className="flex min-h-screen items-start justify-center bg-slate-950 px-4 pt-16">
      <div className="w-full max-w-lg">
        <h1 className="text-lg font-semibold text-slate-100">Welcome, Nam Nguyen</h1>
        <p className="mt-1 text-sm text-slate-500">Today: {today}</p>
        <div className="mt-6">
          <LogForm />
        </div>
      </div>
    </main>
  );
}
