const puppeteer = require('puppeteer');

async function testGameCompanyPage() {
  console.log('브라우저 테스트 시작...');
  
  let browser;
  try {
    // 브라우저 시작
    browser = await puppeteer.launch({
      headless: false, // 브라우저를 시각적으로 표시
      args: ['--window-size=1366,768']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    // 로그인 페이지로 이동
    console.log('로그인 페이지로 이동 중...');
    await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle0' });
    
    // 로그인 양식 작성
    console.log('로그인 정보 입력 중...');
    await page.type('#email', 'admin@example.com');
    await page.type('#password', 'admin123');
    
    // 로그인 버튼 클릭
    console.log('로그인 시도 중...');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);
    
    // 넥셀론 게임사 페이지로 이동
    console.log('넥셀론 게임사 페이지로 이동 중...');
    await page.goto('http://localhost:3000/games/company/넥셀론', { waitUntil: 'networkidle0' });
    
    // 성과 현황 섹션이 있는지 확인
    console.log('성과 현황 섹션 확인 중...');
    const performanceSection = await page.$('.card-header:has-text("글로벌 성과 현황")');
    
    if (performanceSection) {
      console.log('✅ 성과 현황 섹션이 존재합니다.');
      
      // 차트 캔버스가 있는지 확인
      const chartCanvas = await page.$('#performanceChart');
      
      if (chartCanvas) {
        console.log('✅ 성과 현황 차트가 존재합니다.');
        
        // 차트 데이터 확인을 위한 JavaScript 실행
        const chartData = await page.evaluate(() => {
          // 콘솔 로그 확인
          const logs = [];
          const originalConsoleLog = console.log;
          console.log = function() {
            logs.push(Array.from(arguments).join(' '));
            originalConsoleLog.apply(console, arguments);
          };
          
          // 차트 업데이트 함수 실행
          if (typeof updatePerformanceChart === 'function') {
            updatePerformanceChart();
          }
          
          return {
            logs,
            hasChart: document.getElementById('performanceChart') !== null,
            chartVisible: document.getElementById('performanceChart').style.display !== 'none'
          };
        });
        
        console.log('차트 데이터 확인 결과:', chartData);
      } else {
        console.log('❌ 성과 현황 차트가 존재하지 않습니다.');
      }
    } else {
      console.log('❌ 성과 현황 섹션이 존재하지 않습니다.');
    }
    
    // 스크린샷 저장
    console.log('스크린샷 저장 중...');
    await page.screenshot({ path: 'performance-chart-test.png', fullPage: true });
    console.log('✅ 스크린샷이 저장되었습니다: performance-chart-test.png');
    
    // 잠시 대기 후 브라우저 종료
    console.log('테스트 완료. 5초 후 브라우저가 종료됩니다...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('브라우저 테스트 종료');
  }
}

// 테스트 실행
testGameCompanyPage(); 