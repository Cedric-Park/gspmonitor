/**
 * 계약 종료일 순서로 기본 포인트 순차 소진 방식 적용 스크립트
 * 
 * 각 게임사별로:
 * 1. 계약을 종료일 순으로 정렬
 * 2. 빠른 계약부터 기본 포인트 소진
 * 3. 기본 포인트 소진 후 우수 포인트 사용
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/game_points.db');

function parseContractAmount(amountStr) {
  if (!amountStr) return 0;
  const cleanAmount = amountStr.replace(/[,원\s]/g, '');
  const amount = parseInt(cleanAmount);
  return isNaN(amount) ? 0 : amount;
}

async function updateContractPointsSequential() {
  return new Promise((resolve, reject) => {
    // 게임사별로 확정 계약 조회 (종료일 순)
    const query = `
      SELECT 
        c.id,
        c.contract_id,
        c.company_name,
        c.contract_amount,
        c.work_end_date,
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
        AND c.contract_amount IS NOT NULL
        AND c.selected_vendor IS NOT NULL
      ORDER BY c.company_name, c.work_end_date ASC, c.id ASC
    `;
    
    db.all(query, [], async (err, contracts) => {
      if (err) {
        console.error('계약 조회 오류:', err);
        return reject(err);
      }
      
      console.log(`\n총 ${contracts.length}개의 계약을 처리합니다...\n`);
      
      // 게임사별로 그룹화
      const contractsByCompany = {};
      contracts.forEach(contract => {
        if (!contractsByCompany[contract.company_name]) {
          contractsByCompany[contract.company_name] = [];
        }
        contractsByCompany[contract.company_name].push(contract);
      });
      
      let totalUpdated = 0;
      let totalErrors = 0;
      const companies = Object.keys(contractsByCompany);
      
      console.log(`${companies.length}개 게임사의 계약을 처리합니다.\n`);
      
      for (const companyName of companies) {
        const companyContracts = contractsByCompany[companyName];
        console.log(`\n=== ${companyName} (${companyContracts.length}개 계약) ===`);
        
        // 게임사의 기본 포인트 및 우수 포인트 계산
        const firstContract = companyContracts[0];
        let gameBasePoints = 0;
        let gameExcellentPoints = 0;
        let hasExcellentPoints = false;
        
        if (firstContract.assigned_game_id) {
          gameBasePoints = (firstContract.base_points || 0) + (firstContract.self_points || 0);
          const gameTotalPoints = firstContract.total_points || 0;
          gameExcellentPoints = gameTotalPoints - gameBasePoints;
          hasExcellentPoints = (firstContract.excellent_1st_points || 0) > 0 || 
                               firstContract.is_excellent_2nd || 
                               firstContract.is_excellent_3rd;
        }
        
        if (!hasExcellentPoints) {
          console.log(`  일반 게임사 - 모든 계약을 기본 포인트로 처리`);
          // 일반 게임사는 모두 기본 포인트
          for (const contract of companyContracts) {
            const amount = parseContractAmount(contract.contract_amount);
            await updateContract(contract.id, amount);
            totalUpdated++;
          }
        } else {
          console.log(`  우수 게임사 - 순차 소진 방식 적용`);
          console.log(`  기본 포인트: ${gameBasePoints.toLocaleString()}원`);
          console.log(`  우수 포인트: ${gameExcellentPoints.toLocaleString()}원`);
          
          let remainingBasePoints = gameBasePoints;
          
          for (let i = 0; i < companyContracts.length; i++) {
            const contract = companyContracts[i];
            const contractAmount = parseContractAmount(contract.contract_amount);
            
            if (contractAmount === 0) {
              console.log(`  [${i + 1}/${companyContracts.length}] 계약 ${contract.contract_id}: 금액 0원 - 건너뜀`);
              continue;
            }
            
            let basePointsUsed = 0;
            let excellentPointsUsed = 0;
            
            if (remainingBasePoints > 0) {
              // 기본 포인트가 남아있으면 사용
              basePointsUsed = Math.min(contractAmount, remainingBasePoints);
              excellentPointsUsed = contractAmount - basePointsUsed;
              remainingBasePoints -= basePointsUsed;
            } else {
              // 기본 포인트 소진 완료 - 우수 포인트만 사용
              excellentPointsUsed = contractAmount;
            }
            
            console.log(`  [${i + 1}/${companyContracts.length}] 계약 ${contract.contract_id} (종료: ${contract.work_end_date || '미정'})`);
            console.log(`    금액: ${contractAmount.toLocaleString()}원`);
            console.log(`    배분: 기본 ${basePointsUsed.toLocaleString()}원 / 우수 ${excellentPointsUsed.toLocaleString()}원`);
            console.log(`    잔여 기본 포인트: ${remainingBasePoints.toLocaleString()}원`);
            
            try {
              await updateContract(contract.id, basePointsUsed);
              totalUpdated++;
            } catch (error) {
              console.error(`    ✗ 업데이트 실패:`, error.message);
              totalErrors++;
            }
          }
          
          if (remainingBasePoints > 0) {
            console.log(`  ⚠️  미사용 기본 포인트: ${remainingBasePoints.toLocaleString()}원`);
          } else if (remainingBasePoints < 0) {
            console.log(`  ⚠️  기본 포인트 초과 사용: ${Math.abs(remainingBasePoints).toLocaleString()}원`);
          }
        }
      }
      
      console.log(`\n\n=== 처리 완료 ===`);
      console.log(`총 계약: ${contracts.length}개`);
      console.log(`업데이트: ${totalUpdated}개`);
      console.log(`오류: ${totalErrors}개`);
      
      resolve({ updated: totalUpdated, errors: totalErrors, total: contracts.length });
    });
  });
}

function updateContract(contractId, basePointsUsed) {
  return new Promise((resolve, reject) => {
    const updateQuery = `UPDATE contracts SET base_points_used = ? WHERE id = ?`;
    db.run(updateQuery, [basePointsUsed, contractId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// 스크립트 실행
console.log('=== 계약 포인트 순차 소진 방식 업데이트 ===\n');

updateContractPointsSequential()
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


