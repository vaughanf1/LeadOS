import { PageHeader } from "@/components/PageHeader";
import { Chat } from "./Chat";

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="AI Assistant"
        subtitle="Natural-language admin. The assistant always shows a confirmation before changing anything."
      />
      <Chat />
    </>
  );
}
