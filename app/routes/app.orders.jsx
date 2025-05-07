import { useEffect, useState } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useRevalidator, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  IndexTable,
  useIndexResourceState,
  Frame,
  Link,
  Toast,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import kseApi from "../utils/kse";
import LoadingSpinner from "../components/LoadingSpinner";
import db from "../db.server";

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
          phone: node.shippingAddress?.phone || 'No phone',
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
    // KSE API 키 확인
    const kseInfo = await db.kseInformation.findFirst({
      where: { sessionId: admin.rest.session.id }
    });

    if (!kseInfo || !kseInfo.apiKey) {
      return json({ 
        success: false, 
        error: 'KSE API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 입력해주세요.',
        redirectTo: true
      }, { status: 400 });
    }

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
        phone: node.shippingAddress?.phone || 'No phone',
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

export default function Orders() {
  const { orders } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

  const isLoading = navigation.state === "submitting";

  const handleCopy = async (text, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage("클립보드에 복사되었습니다");
      setToastActive(true);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      setToastMessage("클립보드 복사에 실패했습니다");
      setToastActive(true);
    }
  };

  const dismissToast = () => {
    setToastActive(false);
  };

  // 데이터 체크
  if (!orders || !Array.isArray(orders)) {
    return <div>주문 데이터가 없습니다.</div>;
  }

  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show(actionData.message);
    } else if (actionData?.error) {
      shopify.toast.show(actionData.error);
      if (actionData.redirectTo) {
        navigate('/app/settings');
      }
    }
  }, [actionData, navigate]);

  const rowMarkup = orders.map(({ id, orderId, displayName, address, productTitle, variantTitle, quantity, brand, url, phone }, index) => (
    <IndexTable.Row 
      id={id} 
      key={id} 
      selected={selectedResources.includes(id)} 
      position={index}
      onClick={(e) => e.stopPropagation()}
    >
      <IndexTable.Cell>
        <div onClick={(e) => handleCopy(`${orderId} - ${id.split('-')[1]}`, e)} style={{ cursor: 'pointer' }}>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {orderId} - {id.split('-')[1]}
          </Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => handleCopy(productTitle, e)} style={{ cursor: 'pointer' }}>
          <Text variant="bodyMd" as="span">
            {productTitle}
          </Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => handleCopy(brand, e)} style={{ cursor: 'pointer' }}>
          <Text variant="bodyMd" as="span">
            {brand}
          </Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => handleCopy(variantTitle, e)} style={{ cursor: 'pointer' }}>
          <Text variant="bodyMd" as="span">
            {variantTitle}
          </Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => handleCopy(quantity, e)} style={{ cursor: 'pointer' }}>
          <Text variant="bodyMd" as="span">
            {quantity}
          </Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => handleCopy(displayName, e)} style={{ cursor: 'pointer' }}>
          <Text variant="bodyMd" as="span">
            {displayName}
          </Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => handleCopy(phone, e)} style={{ cursor: 'pointer' }}>
          <Text variant="bodyMd" as="span">
            {phone}
          </Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => handleCopy(address, e)} style={{ cursor: 'pointer' }}>
          <Text variant="bodyMd" as="span">
            {address}
          </Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {url ? (
          <Link url={url} external target="_blank" onClick={(e) => e.stopPropagation()}>
            {url}
          </Link>
        ) : ''}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Frame>
      <Page fullWidth>
        <Form method="POST">
          <ui-title-bar title="">
            <button type="button" variant="secondary" onClick={() => revalidator.revalidate()} style={{ marginRight: '10px' }}>
              새로고침
            </button>
            <button type="submit" variant="primary" disabled={isLoading}>주문 전송</button>
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
                    { title: '전화번호' },
                    { title: '고객주소' },
                    { title: '상품URL' }
                  ]}
                  selectable={true}
                  hasZebraStriping={false}
                  onRowClick={() => {}}
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
        {toastActive && (
          <Toast content={toastMessage} onDismiss={dismissToast} />
        )}
      </Page>
    </Frame>
  );
}