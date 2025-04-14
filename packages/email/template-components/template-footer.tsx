import { Trans } from '@lingui/macro';

import { Section, Text } from '../components';
import { useBranding } from '../providers/branding';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  const branding = useBranding();

  return (
    <Section>
      {isDocument && !branding.brandingHidePoweredBy && (
        <Text className="my-4 text-base text-slate-400">
          <Trans>
            This document was sent using <Text className="text-[#7AC455]">Maddocs.</Text>
          </Trans>
        </Text>
      )}
    </Section>
  );
};

export default TemplateFooter;
