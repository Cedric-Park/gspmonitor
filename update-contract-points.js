/**
 * 기존 계약 데이터에 자동 비례 배분 적용 스크립트
 * 
 * 우수게임사의 경우 게임의 기본/우수 포인트 비율에 따라 계약 금액을 배분합니다.
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/game_points.db');

function parseContractAmount(amountStr) {
  if (!amountStr) return 0;
  const cleanAmount = amountStr.replace(/[,원\s]/g, '');
  const amount = parseInt(cleanAmount);
  return isNaN(amount) ? 0 : amount;
}

async function updateContractPoints() {
  return new Promise((resolve, reject) => {
    // 확정 계약 중 게임이 배정되어 있고 base_points_used가 0인 계약 조회
    const query = `
      SELECT 
        c.id,
        c.contract_id,
        c.company_name,
        c.contract_amount,
        c.assigned_game_id,
        g.base_points,
        g.self_points,
        g.total_points,
        g.excellent_1st_points,
        g.is_excellent_2nd,
        g.is_excellent_3rd
      FROM contracts c
      LEFT JOIN games g ON c.assigned_game_id = g.id
      WHERE 
        (c.status = '최종계약체결' OR c.status = '계약종료(정산)')
        AND c.assigned_game_id IS NOT NULL
        AND c.contract_amount IS NOT NULL
        AND c.selected_vendor IS NOT NULL
        AND (c.base_points_used IS NULL OR c.base_points_used = 0)
    `;
    
    db.all(query, [], (err, contracts) => {
      if (err) {
        console.error('계약 조회 오류:', err);
        return reject(err);
      }
      
      console.log(`\n총 ${contracts.length}개의 계약을 처리합니다...\n`);
      
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      
      contracts.forEach((contract, index) => {
        const contractAmount = parseContractAmount(contract.contract_amount);
        
        if (contractAmount === 0) {
          console.log(`[${index + 1}/${contracts.length}] 계약 ${contract.contract_id}: 계약 금액이 0원 - 건너뜀`);
          skipped++;
          return;
        }
        
        // 우수게임사 여부 확인
        const hasExcellentPoints = (contract.excellent_1st_points || 0) > 0 || 
                                   contract.is_excellent_2nd || 
                                   contract.is_excellent_3rd;
        
        let basePointsUsed = contractAmount; // 기본값: 전체 금액을 기본 포인트로
        
        if (hasExcellentPoints) {
          // 우수게임사인 경우 비례 배분
          const gameBasePoints = (contract.base_points || 0) + (contract.self_points || 0);
          const gameTotalPoints = contract.total_points || 0;
          
          if (gameTotalPoints > 0) {
            const baseRatio = gameBasePoints / gameTotalPoints;
            basePointsUsed = Math.round(contractAmount * baseRatio);
            const excellentPointsUsed = contractAmount - basePointsUsed;
            
            console.log(`[${index + 1}/${contracts.length}] 계약 ${contract.contract_id} (${contract.company_name}):`);
            console.log(`  - 계약 금액: ${contractAmount.toLocaleString()}원`);
            console.log(`  - 게임 포인트: 기본 ${gameBasePoints.toLocaleString()}원 / 총 ${gameTotalPoints.toLocaleString()}원`);
            console.log(`  - 비율: 기본 ${(baseRatio * 100).toFixed(1)}%`);
            console.log(`  - 배분: 기본 ${basePointsUsed.toLocaleString()}원 / 우수 ${excellentPointsUsed.toLocaleString()}원`);
          } else {
            console.log(`[${index + 1}/${contracts.length}] 계약 ${contract.contract_id}: 게임 총 포인트가 0원 - 전체를 기본 포인트로`);
          }
        } else {
          console.log(`[${index + 1}/${contracts.length}] 계약 ${contract.contract_id}: 일반 게임사 - 전체를 기본 포인트로`);
        }
        
        // DB 업데이트
        const updateQuery = `UPDATE contracts SET base_points_used = ? WHERE id = ?`;
        db.run(updateQuery, [basePointsUsed, contract.id], function(updateErr) {
          if (updateErr) {
            console.error(`  ✗ 업데이트 실패:`, updateErr.message);
            errors++;
          } else {
            updated++;
          }
          
          // 마지막 계약 처리 완료 시
          if (index === contracts.length - 1) {
            setTimeout(() => {
              console.log(`\n=== 처리 완료 ===`);
              console.log(`총 계약: ${contracts.length}개`);
              console.log(`업데이트: ${updated}개`);
              console.log(`건너뜀: ${skipped}개`);
              console.log(`오류: ${errors}개`);
              resolve({ updated, skipped, errors, total: contracts.length });
            }, 500);
          }
        });
      });
      
      if (contracts.length === 0) {
        console.log('처리할 계약이 없습니다.');
        resolve({ updated: 0, skipped: 0, errors: 0, total: 0 });
      }
    });
  });
}

// 스크립트 실행
console.log('=== 계약 포인트 배분 자동 업데이트 ===\n');

updateContractPoints()
  .then(result => {
    db.close((err) => {
      if (err) {
        console.error('DB 종료 오류:', err.message);
      }
      console.log('\n데이터베이스 연결이 종료되었습니다.');
      process.exit(0);
    });
  })
  .catch(err => {
    console.error('스크립트 실행 오류:', err);
    db.close();
    process.exit(1);
  });


