const db = require('../db/database');

/**
 * 계약금액에서 숫자만 추출하는 함수
 */
function parseContractAmount(contractAmountStr) {
  if (!contractAmountStr || contractAmountStr.trim() === '') {
    return 0;
  }
  
  // "3,986,400 원" 형태에서 숫자만 추출
  const numberStr = contractAmountStr.replace(/[^0-9,]/g, '').replace(/,/g, '');
  const amount = parseInt(numberStr);
  return isNaN(amount) ? 0 : amount;
}

/**
 * 자부담 포인트 우선 사용 여부에 따라 포인트 분배 계산
 */
function calculatePointsDistribution(totalAmount, availableSelfPoints, availableBasePoints, useSelfPointsFirst = false) {
  let selfPointsUsed = 0;
  let basePointsUsed = 0;
  
  if (useSelfPointsFirst) {
    // 자부담포인트 우선 사용
    if (totalAmount <= availableSelfPoints) {
      selfPointsUsed = totalAmount;
      basePointsUsed = 0;
    } else {
      selfPointsUsed = availableSelfPoints;
      const remaining = totalAmount - availableSelfPoints;
      basePointsUsed = Math.min(remaining, availableBasePoints);
    }
  } else {
    // 기본포인트만 사용
    basePointsUsed = Math.min(totalAmount, availableBasePoints);
    selfPointsUsed = 0;
  }
  
  return {
    selfPointsUsed,
    basePointsUsed,
    totalPointsUsed: selfPointsUsed + basePointsUsed,
    isInsufficientPoints: (selfPointsUsed + basePointsUsed) < totalAmount
  };
}

/**
 * 특정 게임의 포인트 사용량 조회 (계약금액 기반 자동 계산)
 */
function getGamePointUsage(gameId) {
  return new Promise((resolve, reject) => {
    // 1. 해당 게임의 기본/자부담 포인트 조회
    const gameQuery = 'SELECT base_points, self_points FROM games WHERE id = ?';
    
    db.get(gameQuery, [gameId], (err, game) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!game) {
        resolve({ totalUsed: 0, selfUsed: 0, baseUsed: 0 });
        return;
      }
      
      // 2. 해당 게임사의 확정된 계약들 조회
      const contractsQuery = `
        SELECT 
          contract_amount,
          use_self_points
        FROM contracts 
        WHERE assigned_game_id = ? 
          AND selected_vendor IS NOT NULL 
          AND contract_amount IS NOT NULL 
          AND contract_amount != ''
      `;
      
      db.all(contractsQuery, [gameId], (err, contracts) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 자부담 우선 사용 계약들과 기본만 사용 계약들 분리
        let selfFirstContracts = [];
        let baseOnlyContracts = [];
        
        contracts.forEach(contract => {
          const amount = parseContractAmount(contract.contract_amount);
          if (amount > 0) {
            const useSelfFirst = contract.use_self_points === 1;
            if (useSelfFirst) {
              selfFirstContracts.push(amount);
            } else {
              baseOnlyContracts.push(amount);
            }
          }
        });
        
        // 총 금액 계산
        const totalSelfFirstAmount = selfFirstContracts.reduce((sum, amount) => sum + amount, 0);
        const totalBaseOnlyAmount = baseOnlyContracts.reduce((sum, amount) => sum + amount, 0);
        
        // 사용 가능한 포인트
        const availableSelfPoints = game.self_points || 0;
        const availableBasePoints = game.base_points || 0;
        
        let totalSelfUsed = 0;
        let totalBaseUsed = 0;
        
        // 1. 자부담 우선 사용 계약들 처리
        if (totalSelfFirstAmount > 0) {
          const selfFirstDistribution = calculatePointsDistribution(
            totalSelfFirstAmount,
            availableSelfPoints,
            availableBasePoints,
            true // 자부담 우선 사용
          );
          
          totalSelfUsed += selfFirstDistribution.selfPointsUsed;
          totalBaseUsed += selfFirstDistribution.basePointsUsed;
        }
        
        // 2. 기본만 사용 계약들 처리 (남은 포인트로)
        if (totalBaseOnlyAmount > 0) {
          const remainingSelfPoints = availableSelfPoints - totalSelfUsed;
          const remainingBasePoints = availableBasePoints - totalBaseUsed;
          
          const baseOnlyDistribution = calculatePointsDistribution(
            totalBaseOnlyAmount,
            remainingSelfPoints,
            remainingBasePoints,
            false // 기본만 사용
          );
          
          totalSelfUsed += baseOnlyDistribution.selfPointsUsed;
          totalBaseUsed += baseOnlyDistribution.basePointsUsed;
        }
        
        resolve({
          totalUsed: totalSelfUsed + totalBaseUsed,
          selfUsed: totalSelfUsed,
          baseUsed: totalBaseUsed
        });
      });
    });
  });
}

/**
 * 모든 게임의 포인트 사용량 조회
 */
function getAllGamesPointUsage() {
  return new Promise((resolve, reject) => {
    // 모든 게임 조회
    const gamesQuery = `
      SELECT id, game_name, company_name, base_points, self_points, total_points
      FROM games
    `;
    
    db.all(gamesQuery, [], async (err, games) => {
      if (err) {
        reject(err);
        return;
      }
      
      try {
        const result = [];
        
        for (const game of games) {
          const usage = await getGamePointUsage(game.id);
          
          result.push({
            id: game.id,
            gameName: game.game_name,
            companyName: game.company_name,
            basePoints: game.base_points || 0,
            selfPoints: game.self_points || 0,
            totalPoints: game.total_points || 0,
            pointsUsed: {
              total: usage.totalUsed,
              self: usage.selfUsed,
              base: usage.baseUsed
            },
            remainingPoints: {
              total: (game.total_points || 0) - usage.totalUsed,
              self: (game.self_points || 0) - usage.selfUsed,
              base: (game.base_points || 0) - usage.baseUsed
            }
          });
        }
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * 계약의 자부담 포인트 우선 사용 설정 토글
 */
function toggleSelfPointsUsage(contractId, useSelfPoints) {
  return new Promise((resolve, reject) => {
    // 계약이 포인트 사용 가능한 상태인지 확인
    const checkQuery = `
      SELECT contract_amount, selected_vendor
      FROM contracts 
      WHERE contract_id = ?
    `;
    
    db.get(checkQuery, [contractId], (err, contract) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!contract) {
        reject(new Error('계약을 찾을 수 없습니다.'));
        return;
      }
      
      if (!contract.contract_amount || !contract.selected_vendor) {
        reject(new Error('계약 금액과 선정 협력사가 확정된 계약만 설정 가능합니다.'));
        return;
      }
      
      // use_self_points 플래그 업데이트
      const updateQuery = `
        UPDATE contracts 
        SET use_self_points = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE contract_id = ?
      `;
      
      db.run(updateQuery, [useSelfPoints ? 1 : 0, contractId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  });
}

// 기존 함수들은 호환성을 위해 유지
function assignPointsToContract(contractId, gameId, contractAmount) {
  return toggleSelfPointsUsage(contractId, true);
}

function unassignPointsFromContract(contractId) {
  return toggleSelfPointsUsage(contractId, false);
}

/**
 * 특정 게임의 서비스 부문별 포인트 사용량 조회
 */
function getGamePointUsageByServiceCategory(gameId) {
  return new Promise((resolve, reject) => {
    // 해당 게임의 확정된 계약들을 서비스 부문별로 조회
    const contractsQuery = `
      SELECT 
        service_category,
        contract_amount,
        use_self_points
      FROM contracts 
      WHERE assigned_game_id = ? 
        AND selected_vendor IS NOT NULL 
        AND contract_amount IS NOT NULL 
        AND contract_amount != ''
        AND status = '최종계약체결'
    `;
    
    db.all(contractsQuery, [gameId], (err, contracts) => {
      if (err) {
        reject(err);
        return;
      }
      
      const categoryBreakdown = {};
      const serviceCategories = ['게임 서비스', '마케팅', '인프라', '컨설팅'];
      
      // 카테고리 초기화
      serviceCategories.forEach(category => {
        categoryBreakdown[category] = {
          totalUsed: 0,
          selfUsed: 0,
          baseUsed: 0,
          contractCount: 0
        };
      });
      
      contracts.forEach(contract => {
        const category = contract.service_category || '기타';
        const amount = parseContractAmount(contract.contract_amount);
        
        if (amount > 0) {
          if (!categoryBreakdown[category]) {
            categoryBreakdown[category] = {
              totalUsed: 0,
              selfUsed: 0,
              baseUsed: 0,
              contractCount: 0
            };
          }
          
          const useSelfFirst = contract.use_self_points === 1;
          
          // 간단히 기본 포인트 사용으로 계산 (정확한 분배는 전체 게임 로직에서 처리)
          if (useSelfFirst) {
            categoryBreakdown[category].selfUsed += amount;
          } else {
            categoryBreakdown[category].baseUsed += amount;
          }
          
          categoryBreakdown[category].totalUsed += amount;
          categoryBreakdown[category].contractCount += 1;
        }
      });
      
      resolve(categoryBreakdown);
    });
  });
}

/**
 * 서비스 부문별 포인트 사용량을 포함한 모든 게임 정보 조회
 */
function getAllGamesPointUsageWithCategories() {
  return new Promise((resolve, reject) => {
    const gamesQuery = `
      SELECT id, game_name, company_name, base_points, self_points, total_points
      FROM games
    `;
    
    db.all(gamesQuery, [], async (err, games) => {
      if (err) {
        reject(err);
        return;
      }
      
      try {
        const result = [];
        
        for (const game of games) {
          const usage = await getGamePointUsage(game.id);
          const categoryUsage = await getGamePointUsageByServiceCategory(game.id);
          
          result.push({
            id: game.id,
            gameName: game.game_name,
            companyName: game.company_name,
            basePoints: game.base_points || 0,
            selfPoints: game.self_points || 0,
            totalPoints: game.total_points || 0,
            pointsUsed: {
              total: usage.totalUsed,
              self: usage.selfUsed,
              base: usage.baseUsed
            },
            remainingPoints: {
              total: (game.total_points || 0) - usage.totalUsed,
              self: (game.self_points || 0) - usage.selfUsed,
              base: (game.base_points || 0) - usage.baseUsed
            },
            categoryUsage
          });
        }
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * 특정 게임의 모든 계약에 대해 포인트 사용량을 계산하고 DB에 저장
 */
function calculateAndSavePerContractUsage(gameId) {
  return new Promise((resolve, reject) => {
    // 1. 게임 정보 조회 (사용 가능 포인트)
    db.get('SELECT id, base_points, self_points FROM games WHERE id = ?', [gameId], (err, game) => {
      if (err || !game) {
        return reject(err || new Error(`Game not found: ${gameId}`));
      }

      // 2. 해당 게임의 모든 확정 계약 조회
      const contractsQuery = `
        SELECT contract_id, contract_amount, use_self_points
        FROM contracts
        WHERE assigned_game_id = ? 
          AND selected_vendor IS NOT NULL 
          AND contract_amount IS NOT NULL 
          AND contract_amount != ''
      `;
      db.all(contractsQuery, [gameId], (err, contracts) => {
        if (err) return reject(err);

        let availableBase = game.base_points || 0;
        let availableSelf = game.self_points || 0;

        const updates = [];
        const selfFirstContracts = contracts.filter(c => c.use_self_points === 1);
        const baseOnlyContracts = contracts.filter(c => c.use_self_points !== 1);

        // 3. 자부담 우선 계약 처리
        const totalSelfFirstAmount = selfFirstContracts.reduce((sum, c) => sum + parseContractAmount(c.contract_amount), 0);
        const selfUsedForBlock = Math.min(totalSelfFirstAmount, availableSelf);
        const baseUsedForBlock = Math.min(totalSelfFirstAmount - selfUsedForBlock, availableBase);
        
        availableSelf -= selfUsedForBlock;
        availableBase -= baseUsedForBlock;

        selfFirstContracts.forEach(c => {
          const amount = parseContractAmount(c.contract_amount);
          const proportion = totalSelfFirstAmount > 0 ? amount / totalSelfFirstAmount : 0;
          const self_points_used = Math.round(selfUsedForBlock * proportion);
          const base_points_used = Math.round(baseUsedForBlock * proportion);
          updates.push({ id: c.contract_id, self: self_points_used, base: base_points_used });
        });

        // 4. 기본 우선 계약 처리
        const totalBaseOnlyAmount = baseOnlyContracts.reduce((sum, c) => sum + parseContractAmount(c.contract_amount), 0);
        const baseUsedForBaseBlock = Math.min(totalBaseOnlyAmount, availableBase);
        
        availableBase -= baseUsedForBaseBlock;

        baseOnlyContracts.forEach(c => {
          const amount = parseContractAmount(c.contract_amount);
          const proportion = totalBaseOnlyAmount > 0 ? amount / totalBaseOnlyAmount : 0;
          const base_points_used = Math.round(baseUsedForBaseBlock * proportion);
          updates.push({ id: c.contract_id, self: 0, base: base_points_used });
        });

        // 5. DB 업데이트 실행
        const promises = updates.map(u => {
          return new Promise((res, rej) => {
            db.run(
              'UPDATE contracts SET self_points_used = ?, base_points_used = ? WHERE contract_id = ?',
              [u.self, u.base, u.id],
              (err) => (err ? rej(err) : res())
            );
          });
        });

        Promise.all(promises).then(resolve).catch(reject);
      });
    });
  });
}

module.exports = {
  parseContractAmount,
  calculatePointsDistribution,
  getGamePointUsage,
  getAllGamesPointUsage,
  getGamePointUsageByServiceCategory,
  getAllGamesPointUsageWithCategories,
  toggleSelfPointsUsage,
  assignPointsToContract,
  unassignPointsFromContract,
  calculateAndSavePerContractUsage
}; 