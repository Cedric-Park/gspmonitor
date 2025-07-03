const db = require('./db/database');
const pointCalculator = require('./models/pointCalculator');

// 데이터베이스 연결 메시지
console.log('SQLite 데이터베이스에 연결되었습니다.');

// 모든 게임 정보 조회
async function checkDashboardCalculation() {
  try {
    console.log('\n=== 대시보드 계산 문제 확인 ===');
    
    // 1. 게임 정보 조회
    const games = await new Promise((resolve, reject) => {
      db.all("SELECT id, game_name, company_name, base_points, self_points, total_points FROM games", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`총 ${games.length}개의 게임 정보를 조회했습니다.`);
    
    // 2. 각 게임별로 계산 방식 비교
    for (const game of games) {
      console.log(`\n--- ${game.company_name} (${game.game_name}) ---`);
      
      // 2.1 pointCalculator.getGamePointUsage 결과 (models/pointCalculator.js에서 사용)
      const pointUsage = await pointCalculator.getGamePointUsage(game.id);
      
      // 2.2 계약 금액 합산 (routes/index.js에서 사용)
      const contracts = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM contracts WHERE assigned_game_id = ? AND status = '최종계약체결' AND selected_vendor IS NOT NULL AND contract_amount IS NOT NULL AND contract_amount != ''", [game.id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      let totalContractAmount = 0;
      contracts.forEach(contract => {
        const amount = pointCalculator.parseContractAmount(contract.contract_amount);
        if (amount > 0) {
          totalContractAmount += amount;
        }
      });
      
      // 2.3 결과 비교
      const totalPoints = game.total_points || 0;
      
      // pointCalculator.js 방식 (getGamePointUsage 결과)
      const calculatorUsed = pointUsage.totalUsed;
      const calculatorRemaining = totalPoints - calculatorUsed;
      const calculatorUsageRate = totalPoints > 0 ? (calculatorUsed / totalPoints * 100) : 0;
      
      // routes/index.js 방식 (계약 금액 합산)
      const contractUsed = totalContractAmount;
      const contractRemaining = totalPoints - contractUsed;
      const contractUsageRate = totalPoints > 0 ? (contractUsed / totalPoints * 100) : 0;
      
      console.log('1. 기본 정보:');
      console.log(`   - 총 포인트: ${totalPoints.toLocaleString()} P`);
      console.log(`   - 기본 포인트: ${game.base_points.toLocaleString()} P`);
      console.log(`   - 자부담 포인트: ${game.self_points.toLocaleString()} P`);
      
      console.log('\n2. pointCalculator.getGamePointUsage 결과 (models/pointCalculator.js):');
      console.log(`   - 사용 포인트: ${calculatorUsed.toLocaleString()} P`);
      console.log(`   - 잔여 포인트: ${calculatorRemaining.toLocaleString()} P`);
      console.log(`   - 사용률: ${calculatorUsageRate.toFixed(1)}%`);
      
      console.log('\n3. 계약 금액 합산 결과 (routes/index.js):');
      console.log(`   - 사용 포인트: ${contractUsed.toLocaleString()} P`);
      console.log(`   - 잔여 포인트: ${contractRemaining.toLocaleString()} P`);
      console.log(`   - 사용률: ${contractUsageRate.toFixed(1)}%`);
      
      // 2.4 views/index.ejs에서 표시되는 방식
      console.log('\n4. views/index.ejs에서 표시되는 방식:');
      console.log(`   - 총 포인트 표시: ${totalPoints.toLocaleString()} P`);
      console.log(`   - 사용 포인트 표시: ${calculatorUsed.toLocaleString()} P (pointCalculator.getGamePointUsage 결과)`);
      console.log(`   - 잔여 포인트 표시: ${calculatorRemaining.toLocaleString()} P (총 포인트 - 사용 포인트)`);
      console.log(`   - 사용률 프로그레스 바: ${contractUsageRate.toFixed(1)}% (계약 금액 / 총 포인트)`);
      
      // 2.5 문제점 확인
      if (Math.abs(calculatorUsed - contractUsed) > 1) {
        console.log('\n⚠️ 문제점: 두 계산 방식의 결과가 다릅니다!');
        console.log(`   - 차이: ${Math.abs(calculatorUsed - contractUsed).toLocaleString()} P`);
        
        if (contractUsageRate >= 100 && calculatorRemaining > 0) {
          console.log('   - 특히 계약 기준 사용률이 100%인데도 잔여 포인트가 있다고 표시됩니다.');
        }
      }
    }
    
    console.log('\n=== 문제 원인 분석 ===');
    console.log('1. 대시보드에서는 두 가지 다른 계산 방식을 혼용하고 있습니다:');
    console.log('   - 프로그레스 바의 사용률: 계약 금액 합계 / 총 포인트');
    console.log('   - 사용/잔여 포인트 표시: pointCalculator.getGamePointUsage 결과');
    console.log('\n2. 이로 인해 다음과 같은 불일치가 발생합니다:');
    console.log('   - 프로그레스 바가 100%여도 잔여 포인트가 0이 아닐 수 있음');
    console.log('   - 사용률과 사용/잔여 포인트 표시가 일관되지 않음');
    
    console.log('\n=== 해결 방안 ===');
    console.log('1. 일관된 계산 방식 사용하기:');
    console.log('   - 모든 곳에서 동일한 계산 방식을 사용 (계약 금액 합계 또는 pointCalculator.getGamePointUsage)');
    console.log('2. views/index.ejs 수정:');
    console.log('   - 사용/잔여 포인트도 계약 금액 기준으로 표시하거나');
    console.log('   - 프로그레스 바도 pointCalculator.getGamePointUsage 결과 기준으로 표시');
  } catch (error) {
    console.error('오류 발생:', error);
  }
}

// 실행
checkDashboardCalculation(); 