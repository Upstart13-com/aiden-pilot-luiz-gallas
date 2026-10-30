import {
  Badge,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@upstart13-com/aiden-ui";
import { AddMemberDialog } from "@/components/admin/add-member-dialog";
import { RoleMenu } from "@/components/admin/role-menu";
import { apiGet } from "@/lib/api-client";
import type { MembersResponse } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { getViewer } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const { me } = await getViewer();
  const { members } = await apiGet<MembersResponse>("/api/admin/members");

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Choose who can work on tickets and who can only read them."
        action={<AddMemberDialog />}
      />
      <div className="space-y-8 px-6 py-8">
        <div className="border-border rounded-sm border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="text-foreground font-semibold">
                  Member
                </TableHead>
                <TableHead className="text-foreground font-semibold">
                  Role
                </TableHead>
                <TableHead className="text-foreground hidden font-semibold sm:table-cell">
                  Joined
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const isMe = m.userId === me.id;
                return (
                  <TableRow key={m.id} className="hover:bg-muted/50">
                    <TableCell className="max-w-0 w-full">
                      <p className="truncate font-medium">
                        {m.name ?? m.email}
                        {isMe && (
                          <Badge variant="secondary" className="ml-2">
                            You
                          </Badge>
                        )}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {m.email}
                      </p>
                    </TableCell>
                    <TableCell className="align-top">
                      {isMe ? (
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {m.role}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Another owner must change your role.
                          </p>
                        </div>
                      ) : (
                        <RoleMenu
                          memberId={m.id}
                          memberName={m.name ?? m.email}
                          role={m.role}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden whitespace-nowrap sm:table-cell">
                      {formatDate(m.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
