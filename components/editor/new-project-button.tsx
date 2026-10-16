"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useCreateEditProjectMutation } from "@/lib/store/endpoints/editor";

export function NewProjectButton({
  videoId,
  label = "New blank project",
}: {
  videoId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [createProject, { isLoading: busy }] = useCreateEditProjectMutation();

  const handleClick = async () => {
    if (busy) return;
    setError(null);
    try {
      const id = await createProject(videoId).unwrap();
      router.push(`/editor/${id}`);
    } catch (cause) {
      setError(apiErrorMessage(cause, "Couldn't start that edit."));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" onClick={() => void handleClick()} disabled={busy}>
        {busy ? "Opening…" : label}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
