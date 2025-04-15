import { Column, Img, Link, Row, Section, Text } from '../components';

export type TemplateFooterProps = {
  isDocument?: boolean;
  assetBaseUrl?: string;
};

export const TemplateFooter = ({
  isDocument = true,
  assetBaseUrl = 'http://localhost:3002',
}: TemplateFooterProps) => {
  return (
    <Section className="mt-8 bg-black px-6 py-8 text-white">
      <Row>
        <Column className="w-1/3 align-middle">
          <Img
            src="https://app.madverse.com/static/logo-onboarding.png"
            alt="MADVERSE"
            width="160"
            className="mb-0 mt-0"
          />
        </Column>

        <Column className="w-2/3 align-middle">
          <Text className="m-0 text-base font-light text-white">
            Tower A, Golf View Corporate Towers,
          </Text>
          <Text className="m-0 text-base font-light text-white">
            Golf Course Road, Gurgaon, Haryana, India, 122002
          </Text>
        </Column>
      </Row>

      <Row className="mt-4">
        <Column>
          <Row>
            <Column className="w-auto pr-6">
              <Link
                href="https://www.instagram.com/madverse.music/"
                className="text-white no-underline"
              >
                <Text className="m-0 text-sm font-light text-white">Instagram</Text>
              </Link>
            </Column>
            <Column className="w-auto">
              <Link
                href="https://in.linkedin.com/company/madverse-music"
                className="text-white no-underline"
              >
                <Text className="m-0 text-sm font-light text-white">Linkedin</Text>
              </Link>
            </Column>
          </Row>
        </Column>
      </Row>
    </Section>
  );
};

export default TemplateFooter;
