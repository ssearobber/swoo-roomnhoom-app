import { json } from "@remix-run/node";
import axios from 'axios';
import https from 'https';
import db from "../db.server";
import googleOrderSheet from './googleSheets/googleOrderSheet.js';

async function fetchOrders(id, admin) {
    return await admin.rest.resources.Order.all({
        session: admin.rest.session,
        status: "any",
        query: `name:${id}`,
    });
}

async function formatLineItems(order, orderName, lineItemIndex) {
    console.log(`[주문 품목 처리] 주문번호 ${orderName}의 품목 처리 시작`);
    
    // 특정 라인 아이템만 처리
    const item = order.line_items[lineItemIndex];
    if (!item) {
        throw new Error(`라인 아이템 인덱스 ${lineItemIndex}를 찾을 수 없습니다.`);
    }

    try {
        const orderNumber = await googleOrderSheet(
            order.id, 
            orderName, 
            item.variant_title,
            item.product_id
        );
        console.log(`[주문 품목 처리] 품목 ${order.id}의 주문번호 조회 완료: ${orderNumber}`);
        
        return [{
            GoodsOrderNo: order.id,
            GoodsCode: order.id,
            Title: item.title,
            TitleEng: "",
            SKU: "",
            HSCODE: "",
            Qty: item.quantity,
            UnitPrice: item.price,
            Currency: "JPY",
            BrandName: "",
            GoodsUrl: "",
            ImageUrl: "",
            Origin: "",
            Material: "",
            OptionCode: "",
            OptionName: item.variant_title + " - "+ orderNumber
        }];
    } catch (error) {
        console.error(`[주문 품목 처리] 품목 ${order.id} 처리 중 오류 발생:`, error);
        throw error;
    }
}

async function formatOrderData(orders, lineItemIndex) {
    console.log('[주문 데이터 변환] 주문 데이터 변환 시작');
    
    if (!orders?.data) {
        console.error("[주문 데이터 변환] 유효하지 않은 주문 데이터:", orders);
        return [];
    }

    if (!Array.isArray(orders.data)) {
        console.error("[주문 데이터 변환] orders.data가 배열이 아님:", orders.data);
        return [];
    }

    return Promise.all(orders.data.map(async order => {
        try {
            console.log(`[주문 데이터 변환] 주문번호 ${order.name} 처리 중`);
            const lineItemsWithOrderNumber = await formatLineItems(order, order.name, lineItemIndex);

            return {
                PackageNo: `${order.name}-${lineItemIndex}`,
                PackageNo2: "",
                DeliveryServiceCode: "KSE",
                TrackingNo: "",
                ToCountry: "JP",
                ReceiverName: `${order.customer.default_address.first_name} ${order.customer.default_address.last_name}`,
                ReceiverNameYomigana: `${order.customer.default_address.first_name} ${order.customer.default_address.last_name}`,
                ReceiverTelNo: order.customer.default_address.phone,
                ReceiverTelNo2: "",
                ReceiverEmail: order.customer.email,
                ReceiverSocialNo: "",
                ReceiverZipCode: order.customer.default_address.zip,
                ReceiverFullAddr: `${order.customer.default_address.province || ''} ${order.customer.default_address.city || ''} ${order.customer.default_address.address1 || ''} ${order.customer.default_address.address2 || ''}`,
                ReceiverStreet: "",
                ReceiverCity: "",
                ReceiverState: "",
                ReceiverNameEng: "",
                ReceiverFullAddrEng: "",
                ReceiverStreetEng: "",
                ReceiverStateEng: "",
                ReceiverCityEng: "",
                RealWeight: 1.0,
                WeightMeasure: "KG",
                Width: 1.1,
                Depth: 1.2,
                Height: 1.3,
                LengthMeasure: "cm",
                DelvMessage: "",
                UserData1: "",
                UserData2: "",
                UserData3: "",
                Market: "shopify",
                ExportDeclarationNo: "",
                GoodsList: lineItemsWithOrderNumber
            };
        } catch (error) {
            console.error(`[주문 데이터 변환] 주문번호 ${order.name} 처리 중 오류 발생:`, error);
            throw error;
        }
    }));
}

async function getKseApiKey(sessionId) {
    const kseInfo = await db.kseInformation.findFirst({
        where: { sessionId }
    });
    if (!kseInfo) throw new Error("Please enter the API key.");
    return kseInfo.apiKey;
}

async function kseApi(id, admin, lineItemIndex) {
    console.log(`[KSE API] ID ${id}, 라인아이템 인덱스 ${lineItemIndex}에 대한 API 처리 시작`);
    
    try {
        const orders = await fetchOrders(id, admin);
        console.log(`[KSE API] ${orders?.data?.length || 0}개의 주문 조회 완료`);

        const formattedOrders = await formatOrderData(orders, lineItemIndex);
        console.log(`[KSE API] ${formattedOrders.length}개의 주문 데이터 변환 완료`);

        const apiKey = await getKseApiKey(admin.rest.session.id);
        const kseUrl = process.env.KSE_URL;

        if (!kseUrl) {
            throw new Error('[KSE API] KSE_URL 환경 변수가 설정되지 않았습니다');
        }

        console.log('[KSE API] KSE API로 요청 전송 중');
        const response = await axios.post(kseUrl, 
            { DataList: formattedOrders },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'KSE-APIKey': apiKey
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                })
            }
        );

        console.log('[KSE API] KSE API 응답 수신:', response.data);
        return json(response.data);
    } catch (error) {
        console.error('[KSE API] 오류 발생:', error);
        throw new Error(`KSE API 처리 중 오류가 발생했습니다: ${error.message}`);
    }
}

export default kseApi;