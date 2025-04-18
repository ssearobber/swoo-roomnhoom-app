import { json } from "@remix-run/node";
import axios from 'axios';
import https from 'https';
import db from "../db.server";

async function formatLineItems(order, orderName, lineItemIndex) {
    console.log(`[주문 품목 처리] 주문번호 ${orderName}의 품목 처리 시작`);
    
    try {
        // 주문번호에서 숫자만 추출
        const orderNumber = order.order.match(/\d+/)?.[0] || order.order;
        
        return [{
            GoodsOrderNo: orderNumber,
            GoodsCode: orderNumber,
            Title: order.productTitle,
            TitleEng: "",
            SKU: "",
            HSCODE: "",
            Qty: order.quantity,
            UnitPrice: order.price,
            Currency: order.currency,
            BrandName: order.brand,
            GoodsUrl: "",
            ImageUrl: "",
            Origin: "",
            Material: "",
            OptionCode: "",
            OptionName: order.variantTitle
        }];
    } catch (error) {
        console.error(`[주문 품목 처리] 품목 ${order.order} 처리 중 오류 발생:`, error);
        throw error;
    }
}

async function formatOrderData(order, lineItemIndex) {
    console.log('[주문 데이터 변환] 주문 데이터 변환 시작');
    
    try {
        console.log(`[주문 데이터 변환] 주문번호 ${order.orderId} 처리 중`);
        const lineItemsWithOrderNumber = await formatLineItems(order, order.orderId, lineItemIndex);

        // 주문의 배송 주소 정보 사용
        const shippingAddress = order.shippingAddress;
        if (!shippingAddress) {
            throw new Error(`주문 ${order.orderId}의 배송 주소 정보가 없습니다.`);
        }

        return {
            PackageNo: `${order.orderId}-${lineItemIndex}`,
            PackageNo2: "",
            DeliveryServiceCode: "KSE",
            TrackingNo: "",
            ToCountry: "JP",
            ReceiverName: order.displayName,
            ReceiverNameYomigana: order.displayName,
            ReceiverTelNo: shippingAddress.phone || "",
            ReceiverTelNo2: "",
            ReceiverEmail: "",
            ReceiverSocialNo: "",
            ReceiverZipCode: shippingAddress.zip,
            ReceiverFullAddr: order.address,
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
        console.error(`[주문 데이터 변환] 주문번호 ${order.orderId} 처리 중 오류 발생:`, error);
        throw error;
    }
}

async function getKseApiKey(sessionId) {
    const kseInfo = await db.kseInformation.findFirst({
        where: { sessionId }
    });
    if (!kseInfo) throw new Error("Please enter the API key.");
    return kseInfo.apiKey;
}

async function kseApi(order, admin, lineItemIndex) {
    console.log(`[KSE API] 주문번호 ${order.orderId}, 라인아이템 인덱스 ${lineItemIndex}에 대한 API 처리 시작`);
    
    try {
        const formattedOrder = await formatOrderData(order, lineItemIndex);
        console.log(`[KSE API] 주문 데이터 변환 완료`);

        const apiKey = await getKseApiKey(admin.rest.session.id);
        const kseUrl = process.env.KSE_URL;

        if (!kseUrl) {
            throw new Error('[KSE API] KSE_URL 환경 변수가 설정되지 않았습니다');
        }

        console.log('[KSE API] KSE API로 요청 전송 중');
        const response = await axios.post(kseUrl, 
            { DataList: [formattedOrder] },
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