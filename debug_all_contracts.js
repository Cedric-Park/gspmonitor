const db = require('./db/database');

async function checkAllContracts() {
  console.log('=== 계약금액이 있는 모든 계약 조회 ===');
  
  const contractsQuery = `
    SELECT 
      contract_id,
      company_name,
      contract_amount,
      selected_vendor,
      assigned_game_id,
      use_self_points
    FROM contracts 
    WHERE contract_amount IS NOT NULL 
      AND contract_amount != ''
    ORDER BY contract_id DESC
    LIMIT 20
  `;
  
  const contracts = await new Promise((resolve, reject) => {
    db.all(contractsQuery, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log(`총 ${contracts.length}개의 계약 발견`);
  
  contracts.forEach((contract, index) => {
    console.log(`\n계약 ${index + 1}:`);
    console.log(`- 계약 ID: ${contract.contract_id}`);
    console.log(`- 회사명: ${contract.company_name}`);
    console.log(`- 계약금액: ${contract.contract_amount}`);
    console.log(`- 선정 협력사: ${contract.selected_vendor}`);
    console.log(`- assigned_game_id: ${contract.assigned_game_id}`);
    console.log(`- use_self_points: ${contract.use_self_points}`);
  });

  // assigned_game_id가 null인 계약들
  const unassignedContracts = contracts.filter(c => !c.assigned_game_id);
  console.log(`\n=== assigned_game_id가 설정되지 않은 계약: ${unassignedContracts.length}개 ===`);
  
  unassignedContracts.forEach(contract => {
    console.log(`- 계약 ${contract.contract_id}: ${contract.company_name} - ${contract.contract_amount}`);
  });

  // 각 회사별 게임 ID 조회
  console.log('\n=== 회사별 게임 ID 조회 ===');
  const companiesQuery = `
    SELECT DISTINCT company_name
    FROM contracts 
    WHERE contract_amount IS NOT NULL 
      AND contract_amount != ''
  `;
  
  const companies = await new Promise((resolve, reject) => {
    db.all(companiesQuery, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  for (const company of companies) {
    const gameQuery = `SELECT id, game_name FROM games WHERE company_name = ?`;
    const game = await new Promise((resolve, reject) => {
      db.get(gameQuery, [company.company_name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (game) {
      console.log(`- ${company.company_name}: 게임 ID ${game.id} (${game.game_name})`);
    } else {
      console.log(`- ${company.company_name}: 게임 정보 없음`);
    }
  }
}

async function main() {
  try {
    await checkAllContracts();
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