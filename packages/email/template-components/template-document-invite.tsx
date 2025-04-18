import { Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { match } from 'ts-pattern';

import { RecipientRole } from '@documenso/prisma/client';

import { Button, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentInviteProps {
  inviterName: string;
  inviterEmail: string;
  documentName: string;
  signDocumentLink: string;
  assetBaseUrl: string;
  role: RecipientRole;
  selfSigner: boolean;
  isTeamInvite: boolean;
  teamName?: string;
  includeSenderDetails?: boolean;
  action: string;
}

export const TemplateDocumentInvite = ({
  inviterName,
  documentName,
  signDocumentLink,
  assetBaseUrl,
  role,
  selfSigner,
  isTeamInvite,
  teamName,
  includeSenderDetails,
  action,
}: TemplateDocumentInviteProps) => {
  const { _ } = useLingui();

  // const { actionVerb } = RECIPIENT_ROLES_DESCRIPTION[role];

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Text className="mt-4 text-center text-sm text-black">
        {`${inviterName} has invited you to ${action}`} <br />
        {`"${documentName}"`}
      </Text>

      <Section>
        <Section className="mb-6 mt-8 text-center">
          <Button
            className="inline-flex items-center justify-center rounded-lg bg-[#84EB0C] px-6 py-3 text-center text-sm font-bold text-black no-underline"
            href={signDocumentLink}
          >
            {match(role)
              .with(RecipientRole.SIGNER, () => <Trans>Sign Document</Trans>)
              .with(RecipientRole.VIEWER, () => <Trans>View Document</Trans>)
              .with(RecipientRole.APPROVER, () => <Trans>Approve Document</Trans>)
              .with(RecipientRole.CC, () => '')
              .with(RecipientRole.ASSISTANT, () => <Trans>Assist Document</Trans>)
              .exhaustive()}
          </Button>
        </Section>
      </Section>
    </>
  );
};

export default TemplateDocumentInvite;
