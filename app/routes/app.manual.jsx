import { Page, Layout, Text, Card, List, Button, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Manual() {
  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingXl" as="h1">
              KSE 앱 사용 매뉴얼
            </Text>
            <Text variant="bodyMd" as="p">
              KSE 앱의 주요 기능과 사용 방법을 안내합니다.
            </Text>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Text variant="headingLg" as="h2">
              초기 설정
            </Text>
            <List type="number">
              <List.Item>
                <Text variant="bodyMd">좌측 메뉴에서 '설정'을 클릭합니다.</Text>
              </List.Item>
              <List.Item>
                <Text variant="bodyMd">KSE API 키를 입력하고 <Button primary>저장</Button> 버튼을 클릭합니다.</Text>
              </List.Item>
            </List>
            <Banner status="info">
              <p>API 키는 KSE 시스템 관리자에게 문의하세요.</p>
            </Banner>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Text variant="headingLg" as="h2">
              주문 관리
            </Text>
            <List type="number">
              <List.Item>
                <Text variant="bodyMd">좌측 메뉴에서 '주문'을 클릭합니다.</Text>
              </List.Item>
              <List.Item>
                <Text variant="bodyMd">미처리 주문 목록이 표시됩니다.</Text>
              </List.Item>
              <List.Item>
                <Text variant="bodyMd">전송할 주문의 체크박스를 선택합니다.</Text>
              </List.Item>
              <List.Item>
                <Text variant="bodyMd">
                  <Button primary>주문 전송</Button> 버튼을 클릭하여 KSE 시스템으로 전송합니다.
                </Text>
              </List.Item>
            </List>
            <Banner status="info">
              <p>주문은 자동으로 검색되지만, 수동으로도 전송할 수 있습니다.</p>
            </Banner>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
