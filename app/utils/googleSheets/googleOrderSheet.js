import { GoogleSpreadsheet } from 'google-spreadsheet';
import { OAuth2Client } from 'google-auth-library';

async function googleOrderSheet(orderID, orderName, productColor, productId) {
  console.log('=== googleOrderSheet 시작 ===');
  console.log('입력받은 파라미터:', { 
    orderID, 
    orderName, 
    productColor, 
    productId 
  });

  // OAuth2 클라이언트 생성
  const oAuth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID || googleClientId,
    process.env.GOOGLE_CLIENT_SECRET || googleClientSecret,
    process.env.GOOGLE_REDIRECT_URI || googleRedirectUri
  );

  // 토큰 설정
  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN || googleRefreshToken
  });

  try {
    // 액세스 토큰 갱신
    const { credentials } = await oAuth2Client.refreshAccessToken();
    oAuth2Client.setCredentials(credentials);
    console.log('OAuth2 인증 설정 완료');
  } catch (error) {
    console.error('OAuth2 인증 실패:', error);
    // 헤로쿠 환경에서는 에러를 throw하지 않고 재시도 로직 추가
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      console.log('네트워크 오류 발생, 5초 후 재시도...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      return googleOrderSheet(orderID, orderName, productColor, productId);
    }
    throw error;
  }

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREAD_ID || googleSpreadId, oAuth2Client);
  console.log('스프레드시트 문서 연결 완료');

  // 문서 로드
  await doc.loadInfo();
  console.log('문서 정보:', {
    제목: doc.title,
    시트수: doc.sheetCount
  });
  
  // sheetId로 시트 선택
  let sheet;
  let sheetId = process.env.GOOGLE_ORDER_SHEET_ID || googleOrderSheetId;
  if (sheetId) {
    sheet = doc.sheetsById[sheetId];
    if (!sheet) {
      console.error(`시트 ID ${sheetId}를 찾을 수 없습니다.`);
      return '';
    }
    console.log('시트 ID로 시트 선택됨:', sheetId);
  } else {
    sheet = doc.sheetsByIndex[0];
    console.log('첫 번째 시트 선택됨');
  }
  console.log('선택된 시트 정보:', {
    시트제목: sheet.title,
    행수: sheet.rowCount,
    열수: sheet.columnCount
  });

  const rows = await sheet.getRows();
  console.log('총 데이터 행 수:', rows.length);

  let orderNumber = '';
  let isOrderID = false;
  
  // 첫번째 체크: orderID와 orderName 확인
  console.log('\n=== 첫 번째 체크 시작 ===');
  for (let i = 1; i < rows.length; i++) {
    const rowOrderID = rows[i].get('orderID') || rows[i]['orderID'];
    const rowOrderName = rows[i].get('orderName') || rows[i]['orderName'];
    
    if (rowOrderID == orderID && rowOrderName == orderName) {
      isOrderID = true;
      console.log(`[첫번째 체크 성공] ${i+2}번째 행에서 일치하는 주문 발견`);
      break;
    }
  }

  if (isOrderID) {
    // 두번째 체크: 모든 조건 확인
    console.log('\n=== 두 번째 체크 시작 ===');
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].get('orderID') == orderID && 
          rows[i].get('orderName') == orderName && 
          rows[i].get('productColor') == productColor && 
          rows[i].get('productId') == productId) {
        
        orderNumber = i + 2;
        console.log(`[두번째 체크 성공] 모든 조건이 일치하는 행 발견! orderNumber:`, orderNumber);
        break;
      }
    }
  } else {
    console.log('[첫번째 체크 실패] 일치하는 주문을 찾지 못했습니다.');
  }

  console.log('=== googleOrderSheet 종료 ===');
  console.log('최종 반환되는 orderNumber:', orderNumber);
  return orderNumber;
}

export default googleOrderSheet;
