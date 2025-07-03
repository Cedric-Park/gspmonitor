const db = require('./db/database');
const pointCalculator = require('./models/pointCalculator');

// 데이터베이스 연결 메시지
console.log('SQLite 데이터베이스에 연결되었습니다.');

// 피벗게임즈 게임 정보 조회
console.log('\n=== 피벗게임즈 게임 정보 조회 ===');
db.get("SELECT * FROM games WHERE company_name = '피벗게임즈'", [], async (err, game) => {
  if (err) {
    console.error('게임 정보 조회 오류:', err);
    process.exit(1);
  }
  
  if (!game) {
    console.log('피벗게임즈 게임 정보가 없습니다.');
    process.exit(0);
  }
  
  console.log('게임 정보:');
  console.log(game);
  
  const gameId = game.id;
  
  // 대시보드 계산 방식 확인 (routes/index.js에서 사용하는 방식)
  console.log('\n=== 대시보드 계산 방식 확인 (최종계약체결 상태만 포함) ===');
  db.all("SELECT * FROM contracts WHERE assigned_game_id = ? AND status = '최종계약체결' AND selected_vendor IS NOT NULL AND contract_amount IS NOT NULL AND contract_amount != ''", [gameId], (err, finalContracts) => {
    if (err) {
      console.error('최종계약체결 계약 정보 조회 오류:', err);
      process.exit(1);
    }
    
    console.log(`최종계약체결 상태 계약 수: ${finalContracts.length}개`);
    let totalFinalAmount = 0;
    
    finalContracts.forEach(contract => {
      const amount = pointCalculator.parseContractAmount(contract.contract_amount);
      totalFinalAmount += amount;
      console.log(`- ${contract.service_category} (${contract.contract_id}): ${amount.toLocaleString()}원`);
    });
    
    console.log(`최종계약체결 상태 계약 총액: ${totalFinalAmount.toLocaleString()}원`);
    
    // pointCalculator.js에서 사용하는 방식 (status 필터링 없음)
    console.log('\n=== pointCalculator.js 계산 방식 확인 (상태 필터링 없음) ===');
    db.all("SELECT * FROM contracts WHERE assigned_game_id = ? AND selected_vendor IS NOT NULL AND contract_amount IS NOT NULL AND contract_amount != ''", [gameId], (err, allContracts) => {
      if (err) {
        console.error('계약 정보 조회 오류:', err);
        process.exit(1);
      }
      
      console.log(`모든 계약 수 (상태 무관): ${allContracts.length}개`);
      let totalAmount = 0;
      
      allContracts.forEach(contract => {
        const amount = pointCalculator.parseContractAmount(contract.contract_amount);
        totalAmount += amount;
        console.log(`- ${contract.service_category} (${contract.contract_id}): ${contract.status} - ${amount.toLocaleString()}원`);
      });
      
      console.log(`모든 계약 총액 (상태 무관): ${totalAmount.toLocaleString()}원`);
      
      // 서비스 부문별 계산 확인
      console.log('\n=== 서비스 부문별 계산 확인 ===');
      
      // 1. 대시보드 방식 (최종계약체결 상태만)
      const dashboardCategoryUsage = {};
      finalContracts.forEach(contract => {
        const category = contract.service_category || '기타';
        const amount = pointCalculator.parseContractAmount(contract.contract_amount);
        dashboardCategoryUsage[category] = (dashboardCategoryUsage[category] || 0) + amount;
      });
      
      console.log('대시보드 방식 서비스 부문별 사용량 (최종계약체결 상태만):');
      Object.entries(dashboardCategoryUsage).forEach(([category, amount]) => {
        console.log(`- ${category}: ${amount.toLocaleString()}원`);
      });
      
      // 2. pointCalculator.js 방식 (상태 필터링 없음)
      const calculatorCategoryUsage = {};
      allContracts.forEach(contract => {
        const category = contract.service_category || '기타';
        const amount = pointCalculator.parseContractAmount(contract.contract_amount);
        calculatorCategoryUsage[category] = (calculatorCategoryUsage[category] || 0) + amount;
      });
      
      console.log('\npointCalculator.js 방식 서비스 부문별 사용량 (상태 무관):');
      Object.entries(calculatorCategoryUsage).forEach(([category, amount]) => {
        console.log(`- ${category}: ${amount.toLocaleString()}원`);
      });
      
      // 실제 API 호출로 확인
      console.log('\n=== 실제 API 호출로 확인 ===');
      pointCalculator.getGamePointUsageByServiceCategory(gameId)
        .then(categoryUsage => {
          console.log('pointCalculator.getGamePointUsageByServiceCategory 결과:');
          Object.entries(categoryUsage).forEach(([category, data]) => {
            if (data.totalUsed > 0) {
              console.log(`- ${category}: ${data.totalUsed.toLocaleString()}원 (계약 ${data.contractCount}개)`);
            }
          });
          process.exit(0);
        })
        .catch(err => {
          console.error('API 호출 오류:', err);
          process.exit(1);
        });
    });
  });
}); 