"use client";
import { Sparkles } from "lucide-react";
import {
  composeFromTemplate,
  type ComposeProfile,
} from "@/shared/policies/compose";
import { questionsFor, type PolicyTemplate } from "@/shared/policies/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Full-document preview of a template: the exact skeleton the deterministic
// draft produces (same shared composeFromTemplate the server uses), plus the
// guided questions the wizard will ask. What you see is what you start from.
export function TemplatePreview({
  template,
  profile,
  canWrite,
  onClose,
  onUse,
}: {
  template: PolicyTemplate;
  profile: ComposeProfile;
  canWrite: boolean;
  onClose: () => void;
  onUse: () => void;
}) {
  const doc = composeFromTemplate(
    { policyName: template.title, templateKey: template.key, answers: {} },
    profile,
    template,
  );
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template.title}</DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="capitalize">
            {template.kind ?? "policy"}
          </Badge>
          <Badge variant="outline">{template.category}</Badge>
          <Badge variant="outline">{template.audience}</Badge>
          <Badge variant="outline">
            Review every {template.reviewMonths} months
          </Badge>
          {template.requiresAcknowledgement && (
            <Badge variant="outline">Staff sign-off</Badge>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What you will be asked ({questionsFor(template.key).length}{" "}
            questions)
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-foreground">
            {questionsFor(template.key).map((q) => (
              <li key={q.key} className="flex gap-2">
                <span className="text-primary">•</span>
                <span className="min-w-0">
                  {q.question}
                  {q.optional ? " (optional)" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Document preview
          </p>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 font-sans text-xs leading-relaxed text-foreground">
            {doc}
          </pre>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            This is the exact structure and default wording the draft starts
            from. Guided answers replace the defaults section by section; when
            AI drafting is enabled, Jova expands the same outline.
          </p>
        </div>

        {canWrite && (
          <DialogFooter>
            <Button onClick={onUse}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Use this template
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
