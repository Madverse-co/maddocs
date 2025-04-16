import { Column, Img, Row, Section } from '../components';

export interface TemplateHeaderProps {
  assetBaseUrl: string;
  className?: string;
}

export const TemplateHeader = ({ assetBaseUrl, className }: TemplateHeaderProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Section className={className}>
      <Row>
        <Column>
          <Img src={getAssetUrl('/static/mad-banner.png')} alt="Madverse Agreements" width="100%" />
        </Column>
      </Row>
    </Section>
  );
};

export default TemplateHeader;
