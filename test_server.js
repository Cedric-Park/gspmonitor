const http = require('http');

// 서버 연결 테스트
function testServerConnection() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data.length > 100 ? data.substring(0, 100) + '...' : data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// 특정 게임사 페이지 테스트
function testCompanyPage(companyName) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/games/company/${encodeURIComponent(companyName)}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // 성과 현황 섹션이 있는지 확인
        const hasPerformanceSection = data.includes('글로벌 성과 현황');
        const hasChartData = data.includes('performanceChart');
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          hasPerformanceSection,
          hasChartData,
          dataLength: data.length
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// 테스트 실행
async function runTests() {
  try {
    console.log('서버 연결 테스트 중...');
    const connectionResult = await testServerConnection();
    console.log('서버 연결 결과:', connectionResult.statusCode);
    
    // 302 리디렉션도 성공으로 간주 (로그인 페이지로 리디렉션)
    if (connectionResult.statusCode === 200 || connectionResult.statusCode === 302) {
      console.log('서버가 정상적으로 실행 중입니다.');
      if (connectionResult.statusCode === 302) {
        console.log('리디렉션 위치:', connectionResult.headers.location);
      }
      
      // 넥셀론 게임사 페이지 테스트
      console.log('\n넥셀론 게임사 페이지 테스트 중...');
      const companyResult = await testCompanyPage('넥셀론');
      
      console.log('넥셀론 게임사 페이지 결과:');
      console.log('- 상태 코드:', companyResult.statusCode);
      
      if (companyResult.statusCode === 302) {
        console.log('- 리디렉션 위치:', companyResult.headers.location);
        console.log('\n❌ 로그인이 필요합니다. 로그인 후 테스트해야 합니다.');
      } else {
        console.log('- 성과 현황 섹션 존재:', companyResult.hasPerformanceSection);
        console.log('- 차트 데이터 존재:', companyResult.hasChartData);
        console.log('- 데이터 길이:', companyResult.dataLength);
        
        if (companyResult.statusCode === 200) {
          if (companyResult.hasPerformanceSection && companyResult.hasChartData) {
            console.log('\n✅ 성과 현황 차트가 정상적으로 표시되고 있습니다.');
          } else {
            console.log('\n❌ 성과 현황 차트가 표시되지 않고 있습니다.');
          }
        } else {
          console.log('\n❌ 게임사 페이지에 접근할 수 없습니다.');
        }
      }
    } else {
      console.log('서버에 연결할 수 없습니다.');
    }
  } catch (error) {
    console.error('테스트 중 오류 발생:', error.message);
  }
}

// 테스트 실행
runTests(); 