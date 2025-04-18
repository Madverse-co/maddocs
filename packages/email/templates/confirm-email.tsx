import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import type { TemplateConfirmationEmailProps } from '../template-components/template-confirmation-email';
import { TemplateConfirmationEmail } from '../template-components/template-confirmation-email';
import { TemplateFooter } from '../template-components/template-footer';

export const ConfirmEmailTemplate = ({
  confirmationLink,
  assetBaseUrl = 'https://agreements.madverse.co',
}: TemplateConfirmationEmailProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`Please confirm your email address`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>
      <Body className="mx-auto my-auto bg-white font-sans">
        <Section>
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
            <Section>
              <TemplateConfirmationEmail
                confirmationLink={confirmationLink}
                assetBaseUrl={assetBaseUrl}
              />
            </Section>
          </Container>
          <div className="mx-auto mt-12 max-w-xl" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter isDocument={false} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default ConfirmEmailTemplate;
