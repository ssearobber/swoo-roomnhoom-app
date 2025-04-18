import { Page, Layout, Text, Card } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingXl" as="h1">
              KSE 앱에 오신 것을 환영합니다
            </Text>
            <Text variant="bodyMd" as="p">
              이 앱은 Shopify 주문을 KSE 시스템과 연동하여 관리하는 도구입니다.
            </Text>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text variant="headingLg" as="h2">
              주요 기능
            </Text>
            <ul>
              <li>
                <Text variant="bodyMd">미처리 주문의 자동 검색</Text>
              </li>
              <li>
                <Text variant="bodyMd">주문 정보의 KSE 시스템 전송</Text>
              </li>
              <li>
                <Text variant="bodyMd">배송 정보 관리</Text>
              </li>
            </ul>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}