const db = require('./db/database');

async function fixAssignedGameIds() {
  console.log('=== assigned_game_id 자동 수정 시작 ===');
  
  // 1. assigned_game_id가 null인 계약들 조회
  const unassignedContractsQuery = `
    SELECT 
      contract_id,
      company_name,
      contract_amount,
      selected_vendor
    FROM contracts 
    WHERE assigned_game_id IS NULL
      AND contract_amount IS NOT NULL 
      AND contract_amount != ''
      AND selected_vendor IS NOT NULL
  `;
  
  const unassignedContracts = await new Promise((resolve, reject) => {
    db.all(unassignedContractsQuery, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log(`수정해야 할 계약 수: ${unassignedContracts.length}개`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (const contract of unassignedContracts) {
    console.log(`\n처리 중: 계약 ${contract.contract_id} - ${contract.company_name}`);
    
    // 회사명으로 게임 ID 조회
    const gameQuery = `SELECT id, game_name FROM games WHERE company_name = ?`;
    const game = await new Promise((resolve, reject) => {
      db.get(gameQuery, [contract.company_name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (game) {
      // assigned_game_id 업데이트
      const updateResult = await new Promise((resolve, reject) => {
        db.run(
          'UPDATE contracts SET assigned_game_id = ? WHERE contract_id = ?',
          [game.id, contract.contract_id],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });
      
      console.log(`✅ 수정 완료: 게임 ID ${game.id} (${game.game_name}) 할당`);
      fixedCount++;
      
    } else {
      console.log(`❌ 게임 정보 없음: ${contract.company_name}`);
      skippedCount++;
    }
  }

  console.log(`\n=== 수정 완료 ===`);
  console.log(`수정된 계약: ${fixedCount}개`);
  console.log(`스킵된 계약: ${skippedCount}개`);

  // 수정 후 포인트 사용량 재계산
  console.log('\n=== 포인트 사용량 재계산 ===');
  const pointCalculator = require('./models/pointCalculator');
  
  const allGamesUsage = await pointCalculator.getAllGamesPointUsage();
  
  // 포인트가 사용된 게임들만 표시
  const gamesWithUsage = allGamesUsage.filter(game => game.pointsUsed.total > 0);
  
  console.log(`포인트가 사용된 게임: ${gamesWithUsage.length}개`);
  
  gamesWithUsage.forEach(game => {
    console.log(`\n- ${game.companyName} (${game.gameName})`);
    console.log(`  총 포인트: ${game.totalPoints.toLocaleString()}원`);
    console.log(`  사용 포인트: ${game.pointsUsed.total.toLocaleString()}원`);
    console.log(`    - 기본: ${game.pointsUsed.base.toLocaleString()}원`);
    console.log(`    - 자부담: ${game.pointsUsed.self.toLocaleString()}원`);
  });

  // 전체 포인트 사용량 집계
  const totalUsed = allGamesUsage.reduce((sum, game) => sum + game.pointsUsed.total, 0);
  const totalSelfUsed = allGamesUsage.reduce((sum, game) => sum + game.pointsUsed.self, 0);
  const totalBaseUsed = allGamesUsage.reduce((sum, game) => sum + game.pointsUsed.base, 0);
  
  console.log(`\n=== 전체 포인트 사용량 ===`);
  console.log(`총 사용 포인트: ${totalUsed.toLocaleString()}원`);
  console.log(`기본 포인트 사용: ${totalBaseUsed.toLocaleString()}원`);
  console.log(`자부담 포인트 사용: ${totalSelfUsed.toLocaleString()}원`);
}

async function main() {
  try {
    await fixAssignedGameIds();
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