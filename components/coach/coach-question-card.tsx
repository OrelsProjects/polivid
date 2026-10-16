import { Button } from "@/components/ui/button";

export function CoachQuestionCard({
  question,
  options,
  onAnswer,
  answered,
}: {
  question: string;
  options?: string[];
  onAnswer: (answer: string) => void;
  answered?: string;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-border bg-white p-4">
      <p className="text-sm font-medium">{question}</p>
      {answered ? (
        <p className="mt-2 text-xs text-muted-foreground">You chose {answered}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {(options ?? []).map((option) => (
            <Button key={option} type="button" size="sm" variant="outline" onClick={() => onAnswer(option)}>
              {option}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => onAnswer("Skip")}>
            Skip
          </Button>
        </div>
      )}
    </div>
  );
}
