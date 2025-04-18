import { Column, Img, Link, Row, Section, Text } from '../components';

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
    <Section className="rounded-lg bg-neutral-950 px-16 py-8 text-white">
      <Row className="items-center justify-between">
        <Column className="w-1/2">
          <Img
            className="mb-2 w-32"
            src={getAssetUrl('/static/madverse-logo.png')}
            alt="MADVERSE"
          />
          <Text className="m-0 text-sm font-light leading-relaxed text-neutral-400">
            Tower A, Golf View Corporate Towers,
          </Text>
          <Text className="m-0 text-sm font-light leading-relaxed text-neutral-400">
            Golf Course Road, Gurgaon, Haryana, India, 122002
          </Text>
        </Column>

        <Column className="w-1/2 text-right">
          <Row className="items-end justify-end gap-4">
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
                src={getAssetUrl('/static/linkedin-icon.png')}
                alt="LinkedIn"
                width="24"
                height="24"
                className="opacity-70 invert transition hover:opacity-100"
              />
            </Link>
          </Row>
        </Column>
      </Row>
    </Section>
  );
};

export default TemplateFooter;
