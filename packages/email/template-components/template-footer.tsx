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
    <Section className="rounded-lg bg-neutral-950 p-8 text-white">
      <Row className="w-full items-center justify-between">
        <Column className="w-1/2">
          <Img
            className="mb-2 w-48"
            src={getAssetUrl('/static/madverse-logo.png')}
            alt="MADVERSE"
          />
        </Column>

        <Column className="flex w-1/2 justify-end gap-4">
          <Link href="https://www.instagram.com/madverse.music/" aria-label="Instagram">
            <Img
              src={getAssetUrl('/static/instagram-icon.png')}
              alt="Instagram"
              width="24"
              height="24"
              className="opacity-70 invert transition hover:opacity-100"
            />
          </Link>
          <Link href="https://www.facebook.com/people/MADverse-Music" aria-label="Facebook">
            <Img
              src={getAssetUrl('/static/facebook-icon.png')}
              alt="Facebook"
              width="24"
              height="24"
              className="opacity-70 invert transition hover:opacity-100"
            />
          </Link>
          <Link href="https://in.linkedin.com/company/madverse-music" aria-label="LinkedIn">
            <Img
              src={getAssetUrl('/static/linkedin-icon.svg')}
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
