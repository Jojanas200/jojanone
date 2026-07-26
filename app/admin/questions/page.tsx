import { requirePlatformAdmin } from "@/server/services/platform-admin";
import {
  getQuestionSet,
  isQuestionSetOverridden,
  listQuestionSets,
} from "@/server/services/question-sets";
import { QuestionSetEditor } from "./QuestionSetEditor";

// Platform-managed questionnaires: the GDPR health check, the tender
// bid/no-bid checklist and every academy final quiz. Edits here change what
// every tenant is asked AND how their scores are derived (the assessment
// engines read the same merged set).

export default async function AdminQuestionsPage() {
  const { role } = await requirePlatformAdmin();
  const metas = listQuestionSets();
  const sets = await Promise.all(
    metas.map(async (meta) => ({
      ...meta,
      items: await getQuestionSet(meta.key),
      overridden: await isQuestionSetOverridden(meta.key),
    })),
  );

  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Questionnaires
        </h1>
        <p className="text-sm text-muted-foreground">
          Edit the questions behind platform assessments. Changes apply to all
          tenants immediately; scores are derived from the same list, so
          removing or adding questions changes how scores are calculated.
        </p>
      </div>
      <QuestionSetEditor sets={sets} canWrite={role === "operator"} />
    </div>
  );
}
