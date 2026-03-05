import LogForm from "@/components/LogForm";

function getFormattedDate(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("vi-VN", {
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
    <main className="flex min-h-screen items-start justify-center px-4 pt-20">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-gray-900">
          Welcome, Nam Nguyen
        </h1>
        <p className="mt-1 text-sm text-gray-500">Today: {today}</p>

        <hr className="my-6 border-gray-200" />

        <LogForm />
      </div>
    </main>
  );
}
