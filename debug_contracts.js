const db = require('./db/database');

function findCompanyNames() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT DISTINCT company_name 
      FROM games 
      WHERE company_name LIKE '%미니%'
      ORDER BY company_name
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('\n=== 미니가 포함된 회사명 ===');
      rows.forEach(row => {
        console.log(`- ${row.company_name}`);
      });
      
      resolve(rows);
    });
  });
}

function checkContractsForCompany(companyName) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        contract_id, 
        company_name, 
        contract_amount, 
        assigned_game_id, 
        use_self_points,
        selected_vendor
      FROM contracts 
      WHERE company_name = ? 
        AND contract_amount IS NOT NULL 
        AND contract_amount != ''
    `;
    
    db.all(query, [companyName], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`\n=== ${companyName} 계약 정보 ===`);
      console.log('총 계약 수:', rows.length);
      
      rows.forEach((row, index) => {
        console.log(`\n계약 ${index + 1}:`);
        console.log(`- 계약 ID: ${row.contract_id}`);
        console.log(`- 계약금액: ${row.contract_amount}`);
        console.log(`- 선정 협력사: ${row.selected_vendor}`);
        console.log(`- assigned_game_id: ${row.assigned_game_id}`);
        console.log(`- use_self_points: ${row.use_self_points}`);
      });
      
      resolve(rows);
    });
  });
}

async function main() {
  try {
    const companies = await findCompanyNames();
    
    if (companies.length > 0) {
      for (const company of companies) {
        await checkContractsForCompany(company.company_name);
        
        // 포인트 계산 테스트
        const pointCalculator = require('./models/pointCalculator');
        const gameQuery = `SELECT id FROM games WHERE company_name = ? LIMIT 1`;
        const gameRow = await new Promise((resolve, reject) => {
          db.get(gameQuery, [company.company_name], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (gameRow) {
          console.log('\n=== 포인트 사용량 계산 테스트 ===');
          const usage = await pointCalculator.getGamePointUsage(gameRow.id);
          console.log('계산된 포인트 사용량:', usage);
        }
      }
    } else {
      console.log('미니가 포함된 회사명이 없습니다.');
    }
    
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