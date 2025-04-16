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
    <Section className="rounded-lg bg-black px-12 py-8 text-white">
      <Row className="items-center justify-between">
        <Column className="w-1/2 align-middle">
          <Img
            className="w-2/3"
            src={getAssetUrl('/static/madverse-logo.png')}
            alt="MADVERSE"
            width="140"
          />
          <Text className="m-0 text-sm font-light text-white">
            Tower A, Golf View Corporate Towers,
          </Text>
          <Text className="m-0 text-sm font-light text-white">
            Golf Course Road, Gurgaon, Haryana, India, 122002
          </Text>
        </Column>

        <Column className="w-1/2 text-right">
          <Row className="justify-end align-bottom">
            <Column className="w-auto px-2">
              <Link href="https://www.instagram.com/madverse.music/" aria-label="Instagram">
                <Img
                  src={getAssetUrl('/static/instagram-icon.svg')}
                  alt="Instagram"
                  width="24"
                  height="24"
                  className="invert"
                />
              </Link>
            </Column>
            <Column className="w-auto px-2">
              <Link href="https://www.facebook.com/people/MADverse-Music" aria-label="Facebook">
                <Img
                  src={getAssetUrl('/static/facebook-icon.svg')}
                  alt="Facebook"
                  width="24"
                  height="24"
                  className="invert"
                />
              </Link>
            </Column>
            <Column className="w-auto px-2">
              <Link href="https://in.linkedin.com/company/madverse-music" aria-label="LinkedIn">
                <Img
                  src={getAssetUrl('/static/linkedin-icon.svg')}
                  alt="LinkedIn"
                  width="24"
                  height="24"
                  className="invert"
                />
              </Link>
            </Column>
          </Row>
        </Column>
      </Row>
    </Section>
  );
};

export default TemplateFooter;
