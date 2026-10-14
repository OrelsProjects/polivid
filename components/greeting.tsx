export function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const first = name.includes("@") ? name.split("@")[0] : name.trim().split(/\s+/)[0] || "there";

  return (
    <h1 suppressHydrationWarning className="text-3xl font-semibold tracking-tight">
      Good {part}, {first}.
    </h1>
  );
}
