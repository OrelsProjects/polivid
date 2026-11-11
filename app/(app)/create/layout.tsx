import { Suspense, type ReactNode } from "react";
import { CurrentStartingPointBar, StartingPointBar } from "@/components/create/starting-point-bar";

/** Every create page gets the same starting-point bar above its form. */
export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-8">
        <Suspense fallback={<StartingPointBar current={null} />}>
          <CurrentStartingPointBar />
        </Suspense>
      </div>
      {children}
    </>
  );
}
