import { useState, useEffect } from "react";
import {
  Card,
  Layout,
  Page,
  Text,
  BlockStack,
  TextField,
} from "@shopify/polaris";
import { Form, useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { randomUUID } from "crypto";
import LoadingSpinner from "../components/LoadingSpinner";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const kseInfo = await db.kseInformation.findFirst({
    where: { sessionId: admin.rest.session.id }
  });
  return json(kseInfo || {});
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const apiKey = formData.get('apiKey');

  if (!admin.rest.session.id) {
    return json({ error: "Session ID is missing" }, { status: 400 });
  }

  const upsertKse = await db.kseInformation.upsert({
    where: { sessionId: admin.rest.session.id },
    update: { apiKey },
    create: {
      id: `KSE-${randomUUID()}`,
      apiKey,
      session: {
        connect: { id: admin.rest.session.id }
      }
    }
  });

  return json({ apiKey: upsertKse.apiKey });
};

export default function SettingsPage() {
  const kseInfo = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [apiKey, setApiKey] = useState('');

  const isLoading = navigation.state === "submitting";

  useEffect(() => {
    if (kseInfo?.apiKey) {
      setApiKey(kseInfo.apiKey);
    }

    if (actionData?.apiKey) {
      shopify.toast.show("API key saved successfully.");
    }
  }, [kseInfo, actionData]);

  const handleApiKeyChange = (value) => setApiKey(value);

  return (
    <Page>
      <Form method="POST">
      <ui-title-bar title="">
        <button variant="primary" submit={true} disabled={isLoading}>
          Save
        </button>
      </ui-title-bar>
        {isLoading && <LoadingSpinner />}
        <Layout>
          <Layout.Section>
            <BlockStack spacing="tight">
              <Text as="h3" variant="headingMd">
                Enter KSE API Key
              </Text>
              <Card sectioned>
                <TextField
                  label="API Key"
                  name="apiKey"
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  autoComplete="off"
                />
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}
