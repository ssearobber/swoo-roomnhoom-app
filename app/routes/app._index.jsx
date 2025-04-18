import { useEffect, useState } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  IndexTable,
  useIndexResourceState,
  Frame,
  Link,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import kseApi from "../utils/kse";
import LoadingSpinner from "../components/LoadingSpinner";

async function fetchOrders(admin) {
  const query = `
    query getOrders {
      orders (first:150, query: "fulfillment_status:unfulfilled") {
        nodes {
          name
          id
          customer {
            displayName
            defaultAddress {
              address1
              address2
              city
              province
              zip
              country
            }
          }
          shippingAddress {
            address1
            address2
            city
            province
            zip
            country
            firstName
            lastName
            phone
          }
          lineItems(first: 10) {
            edges {
              node {
                title
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                variant {
                  title
                }
                product {
                  vendor
                  metafields(first: 10, namespace: "custom") {
                    edges {
                      node {
                        key
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const response = await admin.graphql(query);
  return response.json();
}

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const data = await fetchOrders(admin);
    const orders = data.data.orders.nodes.flatMap(node => 
      node.lineItems.edges.map((edge, index) => {
        const product = edge.node.product;
        const metafields = product?.metafields?.edges || [];
        const urlMetafield = metafields.find(m => m.node.key === 'url')?.node?.value || '';
        const productNameMetafield = metafields.find(m => m.node.key === 'product_name')?.node?.value || '';
        
        return {
          id: `${node.name}-${index}`,
          orderId: node.name,
          order: node.id,
          displayName: node.shippingAddress ? 
            `${node.shippingAddress.firstName} ${node.shippingAddress.lastName}` : 
            node.customer?.displayName || 'No name',
          address: node.shippingAddress ? 
            `${node.shippingAddress.address1} ${node.shippingAddress.address2 || ''}, ${node.shippingAddress.city}, ${node.shippingAddress.province} ${node.shippingAddress.zip}, ${node.shippingAddress.country}` 
            : node.customer?.defaultAddress ? 
              `${node.customer.defaultAddress.address1} ${node.customer.defaultAddress.address2 || ''}, ${node.customer.defaultAddress.city}, ${node.customer.defaultAddress.province} ${node.customer.defaultAddress.zip}, ${node.customer.defaultAddress.country}` 
              : 'No address',
          shippingAddress: node.shippingAddress,
          productTitle: productNameMetafield || edge.node.title,
          variantTitle: edge.node.variant?.title || '',
          quantity: edge.node.quantity,
          price: edge.node.originalUnitPriceSet?.shopMoney?.amount || 0,
          currency: edge.node.originalUnitPriceSet?.shopMoney?.currencyCode || 'JPY',
          brand: edge.node.product?.vendor || '',
          url: urlMetafield
        };
      })
    )
    .filter(order => order.brand === 'Roomnhome')
    .sort((a, b) => b.orderId.localeCompare(a.orderId));
    return json({ orders });
  } catch (error) {
    console.error('app._index Loader Error:', error);
    return json({ orders: [] });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const selectedOrders = formData.getAll('selectedOrder');
  const results = [];

  try {
    // 현재 주문 목록을 다시 가져옵니다
    const data = await fetchOrders(admin);
    const currentOrders = data.data.orders.nodes.flatMap(node => 
      node.lineItems.edges.map((edge, index) => ({
        id: `${node.name}-${index}`,
        orderId: node.name,
        order: node.id,
        displayName: node.shippingAddress ? 
          `${node.shippingAddress.firstName} ${node.shippingAddress.lastName}` : 
          node.customer?.displayName || 'No name',
        address: node.shippingAddress ? 
          `${node.shippingAddress.address1} ${node.shippingAddress.address2 || ''}, ${node.shippingAddress.city}, ${node.shippingAddress.province} ${node.shippingAddress.zip}, ${node.shippingAddress.country}` 
          : node.customer?.defaultAddress ? 
            `${node.customer.defaultAddress.address1} ${node.customer.defaultAddress.address2 || ''}, ${node.customer.defaultAddress.city}, ${node.customer.defaultAddress.province} ${node.customer.defaultAddress.zip}, ${node.customer.defaultAddress.country}` 
            : 'No address',
        shippingAddress: node.shippingAddress,
        productTitle: edge.node.title,
        variantTitle: edge.node.variant?.title || '',
        quantity: edge.node.quantity,
        price: edge.node.originalUnitPriceSet?.shopMoney?.amount || 0,
        currency: edge.node.originalUnitPriceSet?.shopMoney?.currencyCode || 'JPY',
        brand: edge.node.product?.vendor || ''
      }))
    );

    for (const selectedOrder of selectedOrders) {
      const [orderId, lineItemIndex] = selectedOrder.split('-');
      // 선택된 주문 정보 찾기
      const selectedOrderData = currentOrders.find(order => order.id === selectedOrder);
      if (!selectedOrderData) {
        throw new Error(`주문 ${selectedOrder}을 찾을 수 없습니다.`);
      }
      const response = await kseApi(selectedOrderData, admin, parseInt(lineItemIndex));
      results.push(response);
    }
    return json({ success: true, message: 'KSE 시스템에 성공적으로 전송되었습니다.', results });
  } catch (error) {
    console.error('app._index action Error:', error);
    return json({ success: false, error: 'KSE API 호출에 실패했습니다.' }, { status: 500 });
  }
};

export default function Index() {
  const { orders } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

  const isLoading = navigation.state === "submitting";

  // 데이터 체크
  if (!orders || !Array.isArray(orders)) {
    return <div>주문 데이터가 없습니다.</div>;
  }

  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show(actionData.message);
    } else if (actionData?.error) {
      shopify.toast.show(actionData.error);
    }
  }, [actionData]);

  const rowMarkup = orders.map(({ id, orderId, displayName, address, productTitle, variantTitle, quantity, brand, url }, index) => (
    <IndexTable.Row id={id} key={id} selected={selectedResources.includes(id)} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {orderId} - {id.split('-')[1]}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {productTitle}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {brand}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {variantTitle}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {quantity}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {displayName}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {address}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {url ? (
            <Link url={url} external target="_blank" onClick={(e) => e.stopPropagation()}>
              {url}
            </Link>
          ) : ''}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Frame>
      <Page fullWidth>
        <Form method="POST">
          <ui-title-bar title="">
            <button type="button" variant="secondary" onClick={() => revalidator.revalidate()} style={{ marginRight: '10px' }}>
              Refresh
            </button>
            <button type="submit" variant="primary" disabled={isLoading}>Submit</button>
          </ui-title-bar>
          {isLoading && <LoadingSpinner />}
          <Layout>
            <Layout.Section>
              <Card>
                <IndexTable
                  resourceName={{ singular: 'order', plural: 'orders' }}
                  itemCount={orders.length}
                  selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: '주문번호' },
                    { title: '상품명' },
                    { title: '브랜드' },
                    { title: '색상' },
                    { title: '수량' },
                    { title: '고객이름' },
                    { title: '고객주소' },
                    { title: '상품URL' }
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
                {selectedResources.map(resourceId => (
                  <input type="hidden" name="selectedOrder" value={resourceId} key={resourceId} />
                ))}
              </Card>
            </Layout.Section>
          </Layout>
        </Form>
      </Page>
    </Frame>
  );
}