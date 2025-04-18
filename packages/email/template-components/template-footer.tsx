import { Column, Img, Link, Row, Section } from '../components';

export type TemplateFooterProps = {
  isDocument?: boolean;
  assetBaseUrl?: string;
};

export const TemplateFooter = ({
  isDocument = true,
  assetBaseUrl = 'https://agreements.madverse.co',
}: TemplateFooterProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Section style={{ backgroundColor: 'black' }} className="rounded-lg p-8 text-white">
      <Row className="w-full items-center justify-between">
        <Column className="w-[90%]">
          <Img
            className="mb-2 w-48"
            src={getAssetUrl('/static/madverse-logo.png')}
            alt="MADVERSE"
          />
        </Column>

        <Column style={{ display: 'flex', width: '100%' }}>
          <Link
            href="https://www.instagram.com/madverse.music/"
            aria-label="Instagram"
            style={{ marginRight: '10px' }}
          >
            <Img
              src={getAssetUrl('/static/instagram-icon.png')}
              alt="Instagram"
              width="24"
              height="24"
              className="opacity-70 invert transition hover:opacity-100"
            />
          </Link>
          <Link
            href="https://www.facebook.com/people/MADverse-Music"
            aria-label="Facebook"
            style={{ marginRight: '10px' }}
          >
            <Img
              src={getAssetUrl('/static/facebook-icon.png')}
              alt="Facebook"
              width="24"
              height="24"
              className="opacity-70 invert transition hover:opacity-100"
            />
          </Link>
          <Link
            href="https://in.linkedin.com/company/madverse-music"
            aria-label="LinkedIn"
            style={{ marginRight: '10px' }}
          >
            <Img
              src={getAssetUrl('/static/linkedin-icon.png')}
              alt="LinkedIn"
              width="24"
              height="24"
              className="opacity-70 invert transition hover:opacity-100"
            />
          </Link>
        </Column>
      </Row>
    </Section>
  );
};

export default TemplateFooter;
