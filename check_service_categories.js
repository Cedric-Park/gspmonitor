const db = require('./db/database');

async function checkServiceCategories() {
  console.log('=== 서비스 부문별 계약 현황 ===');
  
  // 1. 모든 서비스 카테고리 조회
  const categoriesQuery = `
    SELECT 
      service_category,
      COUNT(*) as contract_count,
      SUM(CASE WHEN contract_amount IS NOT NULL AND contract_amount != '' THEN 1 ELSE 0 END) as contracts_with_amount
    FROM contracts 
    GROUP BY service_category
    ORDER BY contract_count DESC
  `;
  
  const categories = await new Promise((resolve, reject) => {
    db.all(categoriesQuery, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log('서비스 부문별 계약 수:');
  categories.forEach(cat => {
    console.log(`- ${cat.service_category || '미분류'}: ${cat.contract_count}개 (계약금액 있는 것: ${cat.contracts_with_amount}개)`);
  });

  // 2. 계약금액이 있는 서비스 부문별 상세 현황
  console.log('\n=== 계약금액이 있는 서비스 부문별 현황 ===');
  
  const contractsWithAmountQuery = `
    SELECT 
      service_category,
      contract_id,
      company_name,
      contract_amount,
      selected_vendor,
      assigned_game_id
    FROM contracts 
    WHERE contract_amount IS NOT NULL 
      AND contract_amount != ''
      AND selected_vendor IS NOT NULL
    ORDER BY service_category, contract_id
  `;
  
  const contractsWithAmount = await new Promise((resolve, reject) => {
    db.all(contractsWithAmountQuery, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // 서비스 부문별 그룹화
  const groupedByCategory = contractsWithAmount.reduce((acc, contract) => {
    const category = contract.service_category || '미분류';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(contract);
    return acc;
  }, {});

  for (const [category, contracts] of Object.entries(groupedByCategory)) {
    console.log(`\n### ${category} (${contracts.length}개 계약)`);
    
    let totalAmount = 0;
    contracts.forEach(contract => {
      const pointCalculator = require('./models/pointCalculator');
      const amount = pointCalculator.parseContractAmount(contract.contract_amount);
      totalAmount += amount;
      
      console.log(`- 계약 ${contract.contract_id}: ${contract.company_name} - ${amount.toLocaleString()}원`);
    });
    
    console.log(`  총 계약금액: ${totalAmount.toLocaleString()}원`);
  }

  // 3. 포인트 사용량을 서비스 부문별로 집계
  console.log('\n=== 게임별 서비스 부문 포인트 사용량 ===');
  
  const pointCalculator = require('./models/pointCalculator');
  const allGamesUsage = await pointCalculator.getAllGamesPointUsage();
  const gamesWithUsage = allGamesUsage.filter(game => game.pointsUsed.total > 0);
  
  for (const game of gamesWithUsage) {
    console.log(`\n### ${game.companyName} (${game.gameName})`);
    console.log(`총 포인트: ${game.totalPoints.toLocaleString()}원`);
    console.log(`사용 포인트: ${game.pointsUsed.total.toLocaleString()}원`);
    console.log(`잔여 포인트: ${game.remainingPoints.total.toLocaleString()}원`);
    
    // 해당 게임의 계약들을 서비스 부문별로 분류
    const gameContractsQuery = `
      SELECT service_category, contract_amount
      FROM contracts 
      WHERE assigned_game_id = ?
        AND contract_amount IS NOT NULL 
        AND contract_amount != ''
        AND selected_vendor IS NOT NULL
    `;
    
    const gameContracts = await new Promise((resolve, reject) => {
      db.get(`SELECT id FROM games WHERE company_name = ?`, [game.companyName], (err, gameRow) => {
        if (err) reject(err);
        else if (!gameRow) resolve([]);
        else {
          db.all(gameContractsQuery, [gameRow.id], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        }
      });
    });
    
    const categoryUsage = {};
    gameContracts.forEach(contract => {
      const category = contract.service_category || '미분류';
      const amount = pointCalculator.parseContractAmount(contract.contract_amount);
      categoryUsage[category] = (categoryUsage[category] || 0) + amount;
    });
    
    Object.entries(categoryUsage).forEach(([category, amount]) => {
      console.log(`  - ${category}: ${amount.toLocaleString()}원`);
    });
  }
}

async function main() {
  try {
    await checkServiceCategories();
    process.exit(0);
  } catch (error) {
    console.error('오류:', error);
    process.exit(1);
  }
}

// 데이터베이스 초기화 완료 후 실행
db.serialize(() => {
  setTimeout(main, 1000);
}); 