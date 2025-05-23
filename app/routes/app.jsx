import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, useNavigation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import LoadingSpinner from "../components/LoadingSpinner";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData();
  const navigation = useNavigation();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <ui-nav-menu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/manual">메뉴얼</Link>
        <Link to="/app/orders">주문</Link>
        <Link to="/app/settings">설정</Link>
      </ui-nav-menu>
      <div style={{ 
        position: 'relative',
        minHeight: '100vh',
        transition: 'opacity 0.3s ease-in-out',
        opacity: navigation.state === 'loading' ? 0.7 : 1
      }}>
        {navigation.state === 'loading' && <LoadingSpinner />}
        <Outlet />
      </div>
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
