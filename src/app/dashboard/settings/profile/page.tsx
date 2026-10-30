import { ProfileSection } from "@/components/settings/profile-section";
import { getMe } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const me = await getMe();

  return (
    <ProfileSection
      user={{
        id: me.id,
        name: me.name,
        email: me.email,
        image: me.image,
        createdAt: me.createdAt,
        accounts: me.accounts,
        roles: me.roles,
      }}
    />
  );
}
