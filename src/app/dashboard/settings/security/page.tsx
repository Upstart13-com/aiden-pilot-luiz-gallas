import { SecuritySection } from "@/components/settings/security-section";
import { apiGet } from "@/lib/api-client";
import type { SigninsResponse } from "@/lib/api-types";
import { getMe } from "@/lib/page-context";
import { aidenConfig } from "@/../aiden.config";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const [me, { signins }] = await Promise.all([
    getMe(),
    apiGet<SigninsResponse>("/api/me/signins"),
  ]);

  return (
    <SecuritySection
      hasPassword={me.hasPassword}
      credentialsEnabled={aidenConfig.auth.providers.credentials}
      recentSignins={signins}
    />
  );
}
