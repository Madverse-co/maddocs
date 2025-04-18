import { Column, Img, Row, Section, Text } from '../components';

export interface TemplateDocumentImageProps {
  assetBaseUrl: string;
  className?: string;
  documentName?: string;
  inviterName?: string;
  action?: string;
  text?: string;
}

export const TemplateDocumentImage = ({
  assetBaseUrl,
  className,
  documentName,
  inviterName,
  action,
  text,
}: TemplateDocumentImageProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  const previewText = text
    ? `${text}`
    : action
      ? `${inviterName} has invited you to ${action} ${documentName}`
      : `${documentName}`;
  return (
    <Section className={className}>
      <Row className="table-fixed">
        <Column />

        <Column>
          <Img className="h-42 mx-auto" src={getAssetUrl('/static/document.png')} alt="Maddocs" />
          <Text className="text-primary mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold">
            {previewText}
          </Text>
        </Column>

        <Column />
      </Row>
    </Section>
  );
};

export default TemplateDocumentImage;
