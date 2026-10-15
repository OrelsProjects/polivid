"use client";

import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  pendingLabel: ReactNode;
};

/** Submit button for server-action forms. Disables itself and shows a spinner while the action runs. */
export const SubmitButton = ({ children, pendingLabel, disabled, ...props }: SubmitButtonProps) => {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
};
