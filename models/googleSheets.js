const { google } = require('googleapis');
const axios = require('axios');
const config = require('../config/config');

// 구글 스프레드시트에서 데이터 가져오기
async function fetchGameData() {
  try {
    // 스프레드시트 ID와 범위
    const sheetId = config.googleSheet.sheetId;
    
    // 디버깅을 위한 로그
    console.log('스프레드시트 ID:', sheetId);
    
    // CSV 형식으로 내보내기 URL 형식 사용
    // gid 값은 스프레드시트의 시트 ID (GameInfo 시트)
    const gid = '923372488'; 
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    
    console.log('스프레드시트 요청 URL:', exportUrl);
    
    // 요청 시 타임아웃 설정 및 에러 처리 강화
    const response = await axios.get(exportUrl, {
      timeout: 10000, // 10초 타임아웃
      validateStatus: false // 모든 HTTP 상태 코드를 허용하고 reject하지 않음
    });
    
    // HTTP 상태 코드 확인
    if (response.status !== 200) {
      console.error('스프레드시트 요청 실패:', response.status, response.statusText);
      throw new Error(`스프레드시트 요청 실패: ${response.status} ${response.statusText}`);
    }
    
    // 데이터가 없는 경우 확인
    if (!response.data || response.data.trim() === '') {
      console.error('스프레드시트 데이터가 비어 있습니다.');
      throw new Error('스프레드시트 데이터가 비어 있습니다.');
    }
    
    console.log('스프레드시트 데이터 수신 성공');
    
    // 디버깅을 위해 처음 몇 줄만 로깅
    const dataPreview = response.data.split('\n').slice(0, 3).join('\n');
    console.log('데이터 미리보기:', dataPreview);
    
    // CSV 데이터 파싱 (더 견고한 방식으로)
    const rows = response.data.split('\n').filter(row => row.trim() !== '');
    
    if (rows.length < 2) {
      console.error('파싱 가능한 데이터가 충분하지 않습니다:', rows);
      throw new Error('파싱 가능한 데이터가 충분하지 않습니다.');
    }
    
    const headers = rows[0].split(',').map(header => header.trim());
    console.log('헤더:', headers);
    
    const games = [];
    
    // 첫 번째 행은 헤더이므로 건너뛰고 나머지 행 처리
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i] || rows[i].trim() === '') continue; // 빈 행 건너뛰기
      
      // 큰따옴표가 포함된 CSV 필드 처리를 위한 더 견고한 파싱
      const values = parseCSVLine(rows[i]);
      
      if (values.length < 5) {
        console.warn(`행 ${i+1}에 열이 부족합니다. 건너뜁니다:`, rows[i]);
        continue;
      }
      
      // 필요한 데이터 추출 (게임명, 게임사명, 플랫폼, 기본포인트, 자부담포인트)
      const game = {
        game_name: values[0]?.trim() || '',
        company_name: values[1]?.trim() || '',
        platform: values[2]?.trim() || '',
        base_points: parsePointValue(values[3]),
        self_points: parsePointValue(values[4])
      };
      
      // 데이터 유효성 검사
      if (!game.game_name || !game.company_name) {
        console.warn(`행 ${i+1}에 게임명 또는 회사명이 없습니다. 건너뜁니다:`, rows[i]);
        continue;
      }
      
      // 총사용가능 포인트 계산
      game.total_points = game.base_points + game.self_points;
      
      games.push(game);
    }
    
    console.log(`총 ${games.length}개의 게임 데이터를 가져왔습니다.`);
    
    if (games.length === 0) {
      console.error('가져온 게임 데이터가 없습니다.');
      throw new Error('가져온 게임 데이터가 없습니다.');
    }
    
    return games;
  } catch (error) {
    console.error('구글 스프레드시트 데이터 가져오기 오류:', error);
    throw error;
  }
}

// 계약 정보 스프레드시트에서 데이터 가져오기
async function fetchContractData() {
  try {
    // 스프레드시트 ID와 범위
    const sheetId = config.googleSheet.contractSheetId;
    const sheetRange = config.googleSheet.contractRange;
    
    // 디버깅을 위한 로그
    console.log('계약 정보 스프레드시트 ID:', sheetId);
    console.log('계약 정보 시트 범위:', sheetRange);
    
    // 시트 이름 추출
    const sheetName = sheetRange.split('!')[0];
    console.log('계약 정보 시트 이름:', sheetName);
    
    // 직접 CSV 내보내기 URL 사용
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
    
    console.log('계약 정보 스프레드시트 요청 URL:', exportUrl);
    
    // 요청 시 타임아웃 설정 및 에러 처리 강화
    const response = await axios.get(exportUrl, {
      timeout: 20000, // 20초 타임아웃으로 증가
      validateStatus: false, // 모든 HTTP 상태 코드를 허용하고 reject하지 않음
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    // HTTP 상태 코드 확인
    if (response.status !== 200) {
      console.error('계약 정보 스프레드시트 요청 실패:', response.status, response.statusText);
      throw new Error(`계약 정보 스프레드시트 요청 실패: ${response.status} ${response.statusText}`);
    }
    
    // 데이터가 없는 경우 확인
    if (!response.data || response.data.trim() === '') {
      console.error('계약 정보 스프레드시트 데이터가 비어 있습니다.');
      throw new Error('계약 정보 스프레드시트 데이터가 비어 있습니다.');
    }
    
    console.log('계약 정보 스프레드시트 데이터 수신 성공');
    
    // 디버깅을 위해 처음 몇 줄만 로깅
    const dataPreview = response.data.split('\n').slice(0, 3).join('\n');
    console.log('계약 정보 데이터 미리보기:', dataPreview);
    
    // CSV 데이터 파싱
    const rows = response.data.split('\n').filter(row => row.trim() !== '');
    console.log(`총 ${rows.length}개의 행이 있습니다.`);
    
    if (rows.length < 2) {
      console.error('파싱 가능한 계약 정보 데이터가 충분하지 않습니다:', rows);
      throw new Error('파싱 가능한 계약 정보 데이터가 충분하지 않습니다.');
    }
    
    // 전체 원본 데이터 로깅 (디버깅용)
    // console.log('전체 원본 데이터:', response.data);
    
    // 데이터를 하나의 문자열로 합치고 라인 수준에서 처리
    const fullData = response.data;
    
    // 개선된 CSV 파싱 방식 사용
    const parsedData = parseCSV(fullData);
    console.log(`CSV 파싱 결과: ${parsedData.length}개의 행이 파싱되었습니다.`);
    
    if (parsedData.length < 1) {
      console.error('CSV 파싱 후 데이터가 없습니다.');
      throw new Error('CSV 파싱 후 데이터가 없습니다.');
    }
    
    // 헤더 추출
    const headers = parsedData[0];
    console.log('계약 정보 헤더:', headers);
    console.log('헤더 수:', headers.length);
    
    const contracts = [];
    
    // 첫 번째 행은 헤더이므로 건너뛰고 나머지 행 처리
    for (let i = 1; i < parsedData.length; i++) {
      const values = parsedData[i];
      
      // 디버깅을 위한 추가 로그
      if (i < 5 || i % 20 === 0) {
        console.log(`행 ${i+1} 값(${values.length}개):`, values.slice(0, 3).join(', ') + '...');
        // J열 데이터 확인
        if (values.length > 9) {
          console.log(`행 ${i+1}의 J열 데이터:`, values[9]);
        }
      }
      
      if (values.length < 6) { // 최소 필수 필드 수
        console.warn(`행 ${i+1}에 열이 부족합니다(${values.length}개). 건너뜁니다:`, values);
        continue;
      }
      
      // 필요한 데이터 추출
      const contract = {
        id: values[0]?.trim() || '',
        service_category: values[1]?.trim() || '',
        service_detail: values[2]?.trim() || '',
        service_request: values[3]?.trim() || '',
        company_name: values[4]?.trim() || '',
        quote_count: values[5]?.trim() || '0',
        bid_deadline: values.length > 6 ? values[6]?.trim() || '' : '',
        selection_deadline: values.length > 7 ? values[7]?.trim() || '' : '',
        status: values.length > 8 ? values[8]?.trim() || '' : '',
        quote_details: values.length > 9 ? values[9]?.trim() || '' : '',
        selected_vendor: values.length > 10 ? values[10]?.trim() || '' : '',
        contract_amount: values.length > 11 ? values[11]?.trim() || '' : '',
        work_start_date: values.length > 12 ? values[12]?.trim() || '' : '',
        work_end_date: values.length > 13 ? values[13]?.trim() || '' : ''
      };
      
      // 데이터 유효성 검사
      if (!contract.company_name) {
        console.warn(`행 ${i+1}에 회사명이 없습니다. 건너뜁니다:`, values);
        continue;
      }
      
      // 업무상태 계산
      contract.work_status = calculateWorkStatus(contract.work_start_date, contract.work_end_date);
      
      // 견적서 데이터가 있는 경우 로그로 확인
      if (contract.quote_details) {
        console.log(`계약 ID ${contract.id}의 견적서 데이터:`, contract.quote_details);
      }
      
      // 계약 정보 로그 (새로운 필드들)
      if (contract.selected_vendor || contract.contract_amount) {
        console.log(`계약 ID ${contract.id}의 계약 정보: 협력사=${contract.selected_vendor}, 금액=${contract.contract_amount}, 시작일=${contract.work_start_date}, 종료일=${contract.work_end_date}, 상태=${contract.work_status}`);
      }
      
      contracts.push(contract);
    }
    
    console.log(`총 ${contracts.length}개의 계약 정보 데이터를 가져왔습니다.`);
    
    return contracts;
  } catch (error) {
    console.error('계약 정보 스프레드시트 데이터 가져오기 오류:', error);
    throw error;
  }
}

// 특정 게임사의 계약 정보 가져오기
async function getContractsByCompany(companyName) {
  try {
    const allContracts = await fetchContractData();
    return allContracts.filter(contract => contract.company_name === companyName);
  } catch (error) {
    console.error(`${companyName} 게임사의 계약 정보 가져오기 오류:`, error);
    throw error;
  }
}

// 포인트 값 파싱 (콤마와 따옴표 제거 후 숫자로 변환)
function parsePointValue(value) {
  if (!value) return 0;
  
  // 따옴표 제거
  let cleanValue = value.replace(/"/g, '');
  
  // 콤마 제거하고 숫자로 변환
  cleanValue = cleanValue.replace(/,/g, '');
  
  // 숫자로 변환 시도
  const numberValue = Number(cleanValue);
  
  // NaN 체크
  if (isNaN(numberValue)) {
    console.warn(`유효하지 않은 포인트 값: ${value}`);
    return 0;
  }
  
  return numberValue;
}

// CSV 라인을 더 견고하게 파싱하는 함수
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // 따옴표 안의 따옴표 처리 (""는 " 문자를 나타냄)
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // 두 번째 따옴표 건너뛰기
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // 따옴표 밖의 쉼표는 필드 구분자
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // 마지막 필드 추가
  result.push(current);
  
  return result;
}

// CSV 데이터를 파싱하는 개선된 함수 (열 내부의 줄바꿈 처리 지원)
function parseCSV(csvString) {
  // 결과 배열
  const result = [];
  
  // CSV 줄을 하나씩 처리하기 위한 변수들
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;
  
  // 줄 단위가 아닌 문자 단위로 처리
  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    const nextChar = i < csvString.length - 1 ? csvString[i + 1] : '';
    
    // 따옴표 처리
    if (char === '"') {
      // 따옴표 안의 따옴표 처리 (""는 " 문자)
      if (nextChar === '"') {
        currentField += '"';
        i++; // 두 번째 따옴표 건너뛰기
      } else {
        // 따옴표 상태 토글
        inQuotes = !inQuotes;
      }
    }
    // 줄바꿈 처리
    else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // 현재 필드 마무리
      currentLine.push(currentField);
      currentField = '';
      
      // 행 추가
      result.push(currentLine);
      currentLine = [];
      
      // \r\n인 경우 \n 건너뛰기
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    }
    // 쉼표 처리
    else if (char === ',' && !inQuotes) {
      // 현재 필드 마무리하고 다음 필드로
      currentLine.push(currentField);
      currentField = '';
    }
    // 일반 문자 처리
    else {
      currentField += char;
    }
  }
  
  // 마지막 필드와 라인 처리
  if (currentField !== '' || currentLine.length > 0) {
    currentLine.push(currentField);
    result.push(currentLine);
  }
  
  return result;
}

// 업무상태 계산 함수
function calculateWorkStatus(startDate, endDate) {
  // 날짜가 없으면 상태 없음
  if (!startDate || !endDate) {
    return '';
  }
  
  try {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 유효하지 않은 날짜 확인
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return '';
    }
    
    // 현재 시간을 기준으로 상태 결정
    if (now < start) {
      return '예정';
    } else if (now > end) {
      return '업무 종료';
    } else {
      return '진행 중';
    }
  } catch (error) {
    console.error('업무상태 계산 오류:', error);
    return '';
  }
}

// 수동으로 스프레드시트 데이터 가져오기 테스트
async function testFetchGameData() {
  try {
    const games = await fetchGameData();
    console.log('가져온 게임 데이터:', games);
    return games;
  } catch (error) {
    console.error('테스트 실패:', error);
    return [];
  }
}

// 모듈 내보내기
module.exports = {
  fetchGameData,
  fetchContractData,
  getContractsByCompany,
  parsePointValue,
  parseCSVLine,
  parseCSV,
  calculateWorkStatus,
  // 테스트 함수
  testFetchGameData,
  // PointUsageDB 업데이트 함수 추가
  updatePointUsageDB
};

// PointUsageDB 스프레드시트에 데이터 업데이트하는 함수
async function updatePointUsageDB(contracts) {
  try {
    console.log('PointUsageDB 업데이트 시작');

    // 구글 OAuth 클라이언트 인증 설정
    const auth = new google.auth.GoogleAuth({
      keyFile: 'credentials.json',  // 서비스 계정 인증 파일 경로
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // 스프레드시트 ID와 시트 이름
    const sheetId = config.googleSheet.pointUsageDBSheetId || '1rwYFY1VdwF5eRS0QKEa5NhJp_xQOtVfqCxaV0oeEI3A'; // 구글 시트 ID
    const sheetName = 'PointUsageDB'; // 시트 이름

    console.log(`PointUsageDB 스프레드시트 ID: ${sheetId}, 시트 이름: ${sheetName}`);

    // 기존 PointUsageDB 데이터 가져오기
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:Z`,  // 전체 데이터 범위 (W -> Z로 확장)
    });

    const rows = existingData.data.values || [];
    console.log(`기존 데이터 ${rows.length}개 행 로드됨`);

    // 헤더 행 가져오기
    const headers = rows.length > 0 ? rows[0] : [];
    
    // 계약코드 열 인덱스 찾기
    const contractCodeIndex = headers.findIndex(header => header === '계약코드');
    
    if (contractCodeIndex === -1) {
      throw new Error('계약코드 열을 찾을 수 없습니다');
    }

    // 기존 계약코드 목록과 매핑
    const existingContractCodes = {};
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][contractCodeIndex]) {
        existingContractCodes[rows[i][contractCodeIndex]] = i;  // 계약코드와 행 인덱스 매핑
      }
    }

    // 다음 계약코드 번호 계산
    let nextContractNumber = 1;
    Object.keys(existingContractCodes).forEach(code => {
      if (code.startsWith('T')) {
        const num = parseInt(code.substring(1));
        if (!isNaN(num) && num >= nextContractNumber) {
          nextContractNumber = num + 1;
        }
      }
    });

    console.log(`다음 계약코드 번호: T${nextContractNumber.toString().padStart(5, '0')}`);

    // 업데이트할 데이터 준비
    const updates = [];
    const newRows = [];
    const processedContracts = [];
    
    for (const contract of contracts) {
      // 계약 데이터를 PointUsageDB 형식으로 변환
      const rowData = transformContractToPointUsageDB(contract, headers);
      
      // 계약코드 생성 (새 데이터) 또는 할당 (기존 데이터)
      let contractCode;
      
      if (contract.pointUsageDBCode) {
        // 이미 계약코드가 있는 경우
        contractCode = contract.pointUsageDBCode;
      } else {
        // 새 계약코드 생성
        contractCode = `T${nextContractNumber.toString().padStart(5, '0')}`;
        nextContractNumber++;
      }
      
      // 계약코드 설정
      rowData[contractCodeIndex] = contractCode;

      // 처리된 계약 정보 저장 (새 계약코드 포함)
      processedContracts.push({
        ...contract,
        pointUsageDBCode: contractCode
      });
      
      // 이 계약코드가 이미 존재하는지 확인
      if (existingContractCodes[contractCode] !== undefined) {
        // 기존 데이터 업데이트
        const rowIndex = existingContractCodes[contractCode];
        const range = `${sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`; // 범위 확장
        
        // 기존 행과 새 행이 다른지 확인
        const existingRow = rows[rowIndex];
        let isDifferent = false;
        
        for (let i = 0; i < rowData.length; i++) {
          if (i < existingRow.length && rowData[i] !== existingRow[i]) {
            isDifferent = true;
            break;
          }
        }
        
        if (isDifferent) {
          // 변경사항이 있을 경우만 업데이트
          updates.push({
            range,
            values: [rowData]
          });
          console.log(`계약코드 ${contractCode} 업데이트 예정`);
        }
      } else {
        // 새 데이터 추가
        newRows.push(rowData);
        console.log(`계약코드 ${contractCode} 추가 예정`);
      }
    }

    // 업데이트 요청 실행
    let updateResults = { updatedRows: 0 };
    if (updates.length > 0) {
      updateResults = await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
      console.log(`${updates.length}개 행이 업데이트되었습니다.`);
    }

    // 새 행 추가 요청 실행
    let appendResults = { updatedRows: 0 };
    if (newRows.length > 0) {
      appendResults = await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:Z`, // 범위 확장
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: newRows
        }
      });
      console.log(`${newRows.length}개 새 행이 추가되었습니다.`);
    }

    return {
      success: true,
      message: 'PointUsageDB 업데이트 완료',
      updatedRows: updateResults.updatedRows || 0,
      appendedRows: newRows.length,
      nextContractCode: `T${nextContractNumber.toString().padStart(5, '0')}`,
      contracts: processedContracts // 처리된 계약 목록 반환
    };
  } catch (error) {
    console.error('PointUsageDB 업데이트 오류:', error);
    throw error;
  }
}

// 계약 정보를 PointUsageDB 형식으로 변환하는 함수
function transformContractToPointUsageDB(contract, headers) {
  // 날짜 형식 추출 함수
  const extractYearMonth = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  // 금액에서 P와 쉼표 제거
  const cleanAmount = (amountStr) => {
    if (!amountStr) return 0;
    return parseInt(amountStr.toString().replace(/[^0-9]/g, '')) || 0;
  };

  // 기본 빈 배열 생성 (헤더 길이만큼)
  const rowData = new Array(headers.length).fill('');

  // 헤더별 데이터 매핑
  headers.forEach((header, index) => {
    switch(header) {
      case '#':
        rowData[index] = ''; // 자동 번호 부여됨
        break;
      case '협력사명':
        rowData[index] = contract.selected_vendor || '';
        break;
      case '게임사명':
        rowData[index] = contract.company_name || '';
        break;
      case '국내/해외':
        rowData[index] = '국내'; // 기본값
        break;
      case '서비스 부문': // 이전 '대분류'
        rowData[index] = contract.service_category || '';
        break;
      case '상세 서비스 항목': // 이전 '소분류'
        rowData[index] = contract.service_detail || '';
        break;
      case '서비스 요청명': // 이전 '상세 서비스명'
        rowData[index] = contract.service_request || '';
        break;
      case '계약일자':
        rowData[index] = contract.selection_deadline || '';
        break;
      case '완료일자':
        rowData[index] = contract.work_end_date || '';
        break;
      case '결과물 검수일':
        rowData[index] = ''; // 비워둠
        break;
      case '진행상황':
        rowData[index] = contract.status || '';
        break;
      case '정산상태':
        rowData[index] = '정산대기';
        break;
      case '계약금액 (KRW)':
        rowData[index] = cleanAmount(contract.contract_amount);
        break;
      case '계약금액 (USD)':
        rowData[index] = 0;
        break;
      case '환율':
        rowData[index] = 0;
        break;
      case '환산 금액 (KRW)':
        rowData[index] = cleanAmount(contract.contract_amount);
        break;
      case '정산대기사유':
        rowData[index] = '';
        break;
      case '포인트 출처':
        // 포인트 출처는 공란으로 둠
        rowData[index] = '';
        break;
      case '계약월구분':
        rowData[index] = extractYearMonth(contract.selection_deadline);
        break;
      case '완료월구분':
        rowData[index] = extractYearMonth(contract.work_end_date);
        break;
      case '최종승인일자':
        rowData[index] = '';
        break;
      case '정산일자':
        rowData[index] = '1900-01-01';
        break;
      case '계약코드':
        rowData[index] = contract.pointUsageDBCode || ''; // 나중에 설정됨
        break;
      case '기본 차감':
        rowData[index] = cleanAmount(contract.contract_amount);
        break;
      case '자부담 차감':
      case '우수 차감':
        rowData[index] = 0;
        break;
    }
  });

  return rowData;
} 