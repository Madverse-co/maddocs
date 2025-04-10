'use client';

import { useMemo, useTransition } from 'react';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';
import { DateTime } from 'luxon';
import { useSession } from 'next-auth/react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { Team } from '@documenso/prisma/client';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import type { TFindDocumentsResponse } from '@documenso/trpc/server/document-router/schema';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';

import { StackAvatarsWithTooltip } from '~/components/(dashboard)/avatar/stack-avatars-with-tooltip';
import { DocumentStatus } from '~/components/formatter/document-status';

import { DataTableActionButton } from './data-table-action-button';
import { DataTableActionDropdown } from './data-table-action-dropdown';
import { DataTableTitle } from './data-table-title';

export type DocumentsDataTableProps = {
  results: TFindDocumentsResponse;
  showSenderColumn?: boolean;
  team?: Pick<Team, 'id' | 'url'> & { teamEmail?: string };
};

export const DocumentsDataTable = ({
  results,
  showSenderColumn,
  team,
}: DocumentsDataTableProps) => {
  const { _, i18n } = useLingui();

  const { data: session } = useSession();

  const [isPending, startTransition] = useTransition();

  const updateSearchParams = useUpdateSearchParams();

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) =>
          i18n.date(row.original.createdAt, { ...DateTime.DATETIME_SHORT, hourCycle: 'h12' }),
      },
      {
        header: _(msg`Title`),
        cell: ({ row }) => (
          <DataTableTitle row={{ ...row.original, lastResentAt: null }} teamUrl={team?.url} />
        ),
      },
      {
        id: 'sender',
        header: _(msg`Sender`),
        cell: ({ row }) => row.original.user.name ?? row.original.user.email,
      },
      {
        header: _(msg`Recipient`),
        accessorKey: 'recipient',
        cell: ({ row }) => (
          <StackAvatarsWithTooltip
            recipients={row.original.recipients}
            documentStatus={row.original.status}
          />
        ),
      },
      {
        header: _(msg`Status`),
        accessorKey: 'status',
        cell: ({ row }) => <DocumentStatus status={row.original.status} />,
        size: 140,
      },
      {
        header: _(msg`Actions`),
        cell: ({ row }) =>
          (!row.original.deletedAt || row.original.status === ExtendedDocumentStatus.COMPLETED) && (
            <div className="flex items-center gap-x-4">
              <DataTableActionButton team={team} row={{ ...row.original, lastResentAt: null }} />
              <DataTableActionDropdown team={team} row={{ ...row.original, lastResentAt: null }} />
            </div>
          ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, [team]);

  const onPaginationChange = (page: number, perPage: number) => {
    startTransition(() => {
      updateSearchParams({
        page,
        perPage,
      });
    });
  };

  if (!session) {
    return null;
  }

  return (
    <div className="relative">
      <DataTable
        columns={columns}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
        columnVisibility={{
          sender: Boolean(showSenderColumn),
        }}
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>

      {isPending && (
        <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
          <Loader className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  );
};
