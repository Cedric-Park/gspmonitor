const db = require('../db/database');
const googleSheets = require('./googleSheets');
const pointCalculator = require('./pointCalculator');

// 모든 게임 정보 가져오기
function getAllGames() {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM games ORDER BY company_name, game_name`;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 포인트 사용량을 포함한 모든 게임 정보 가져오기
async function getAllGamesWithPointUsage() {
  try {
    return await pointCalculator.getAllGamesPointUsage();
  } catch (error) {
    console.error('포인트 사용량 조회 오류:', error);
    throw error;
  }
}

// 서비스 부문별 포인트 사용량을 포함한 모든 게임 정보 가져오기
async function getAllGamesWithPointUsageAndCategories() {
  try {
    return await pointCalculator.getAllGamesPointUsageWithCategories();
  } catch (error) {
    console.error('서비스 부문별 포인트 사용량 조회 오류:', error);
    throw error;
  }
}

// 게임 정보 추가
function addGame(game) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO games (game_name, company_name, platform, base_points, self_points, total_points)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.run(
      query, 
      [game.game_name, game.company_name, game.platform, game.base_points, game.self_points, game.total_points],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, ...game });
      }
    );
  });
}

// 게임 정보 업데이트
function updateGame(id, game) {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE games
      SET game_name = ?, company_name = ?, platform = ?, 
          base_points = ?, self_points = ?, total_points = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(
      query, 
      [game.game_name, game.company_name, game.platform, game.base_points, game.self_points, game.total_points, id],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id, ...game, changes: this.changes });
      }
    );
  });
}

// 게임사별 포인트 합계
function getPointsByCompany() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        company_name,
        SUM(base_points) as total_base_points,
        SUM(self_points) as total_self_points,
        SUM(total_points) as total_points,
        COUNT(id) as game_count,
        GROUP_CONCAT(DISTINCT platform) as platforms
      FROM games
      GROUP BY company_name
      ORDER BY company_name
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 특정 게임사들의 포인트 합계
function getPointsByCompanies(companyNames) {
  return new Promise((resolve, reject) => {
    // 빈 배열이거나 유효하지 않은 입력인 경우
    if (!companyNames || !Array.isArray(companyNames) || companyNames.length === 0) {
      resolve([]);
      return;
    }
    
    // SQL 쿼리의 IN 절에 사용할 파라미터 생성
    const placeholders = companyNames.map(() => '?').join(',');
    
    const query = `
      SELECT 
        company_name,
        SUM(base_points) as total_base_points,
        SUM(self_points) as total_self_points,
        SUM(total_points) as total_points,
        COUNT(id) as game_count,
        GROUP_CONCAT(DISTINCT platform) as platforms
      FROM games
      WHERE company_name IN (${placeholders})
      GROUP BY company_name
      ORDER BY company_name
    `;
    
    db.all(query, companyNames, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 계약 정보 저장 또는 업데이트
function saveContract(contract) {
  return new Promise((resolve, reject) => {
    // 먼저 계약이 있는지 확인
    const checkQuery = `SELECT * FROM contracts WHERE contract_id = ?`;
    db.get(checkQuery, [contract.id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row) {
        // 기존 계약의 assigned_game_id가 없으면 설정
        if (!row.assigned_game_id) {
          db.get('SELECT id FROM games WHERE company_name = ? LIMIT 1', [contract.company_name], (gameErr, gameRow) => {
            const gameId = gameRow ? gameRow.id : null;
            
            // 기존 계약 정보 업데이트 (assigned_game_id 포함)
            const updateQuery = `
              UPDATE contracts 
              SET service_category = ?, 
                  service_detail = ?, 
                  service_request = ?, 
                  company_name = ?, 
                  quote_count = ?, 
                  bid_deadline = ?, 
                  selection_deadline = ?, 
                  status = ?, 
                  quote_details = ?,
                  selected_vendor = ?,
                  contract_amount = ?,
                  work_start_date = ?,
                  work_end_date = ?,
                  work_status = ?,
                  assigned_game_id = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE contract_id = ?
            `;
            
            db.run(
              updateQuery, 
              [
                contract.service_category, 
                contract.service_detail, 
                contract.service_request, 
                contract.company_name, 
                contract.quote_count, 
                contract.bid_deadline, 
                contract.selection_deadline, 
                contract.status, 
                contract.quote_details,
                contract.selected_vendor,
                contract.contract_amount,
                contract.work_start_date,
                contract.work_end_date,
                contract.work_status, 
                gameId,
                contract.id
              ],
              function(err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve({ id: contract.id, ...contract, updated: true });
              }
            );
          });
        } else {
          // assigned_game_id가 이미 있으면 기존 로직 사용
          const updateQuery = `
            UPDATE contracts 
            SET service_category = ?, 
                service_detail = ?, 
                service_request = ?, 
                company_name = ?, 
                quote_count = ?, 
                bid_deadline = ?, 
                selection_deadline = ?, 
                status = ?, 
                quote_details = ?,
                selected_vendor = ?,
                contract_amount = ?,
                work_start_date = ?,
                work_end_date = ?,
                work_status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE contract_id = ?
          `;
          
          db.run(
            updateQuery, 
            [
              contract.service_category, 
              contract.service_detail, 
              contract.service_request, 
              contract.company_name, 
              contract.quote_count, 
              contract.bid_deadline, 
              contract.selection_deadline, 
              contract.status, 
              contract.quote_details,
              contract.selected_vendor,
              contract.contract_amount,
              contract.work_start_date,
              contract.work_end_date,
              contract.work_status, 
              contract.id
            ],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve({ id: contract.id, ...contract, updated: true });
            }
          );
        }
      } else {
        // 해당 게임사의 첫 번째 게임 ID 찾기 (포인트 계산용)
        db.get('SELECT id FROM games WHERE company_name = ? LIMIT 1', [contract.company_name], (gameErr, gameRow) => {
          if (gameErr) {
            console.error('게임 조회 오류:', gameErr);
            // 게임 ID를 찾지 못해도 계약은 저장
          }
          
          const gameId = gameRow ? gameRow.id : null;
          
          // 새 계약 정보 추가
          const insertQuery = `
            INSERT INTO contracts (
              contract_id, 
              service_category, 
              service_detail, 
              service_request, 
              company_name, 
              quote_count, 
              bid_deadline, 
              selection_deadline, 
              status, 
              quote_details,
              selected_vendor,
              contract_amount,
              work_start_date,
              work_end_date,
              work_status,
              assigned_game_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          
          db.run(
            insertQuery, 
            [
              contract.id, 
              contract.service_category, 
              contract.service_detail, 
              contract.service_request, 
              contract.company_name, 
              contract.quote_count, 
              contract.bid_deadline, 
              contract.selection_deadline, 
              contract.status, 
              contract.quote_details,
              contract.selected_vendor,
              contract.contract_amount,
              contract.work_start_date,
              contract.work_end_date,
              contract.work_status,
              gameId
            ],
            function(err) {
              if (err) {
                reject(err);
                return;
              }
              resolve({ id: contract.id, ...contract, added: true });
            }
          );
        });
      }
    });
  });
}

// 특정 게임사의 계약 정보 가져오기
function getContractsByCompany(companyName) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM contracts 
      WHERE company_name = ? 
      ORDER BY selection_deadline DESC, bid_deadline DESC
    `;
    
    db.all(query, [companyName], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 모든 게임사의 계약 정보 존재 여부 확인
function getCompanyContractStatus() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT DISTINCT company_name, 
      (SELECT COUNT(*) FROM contracts WHERE contracts.company_name = games.company_name) as contract_count
      FROM games
      ORDER BY company_name
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      const result = {};
      rows.forEach(row => {
        result[row.company_name] = row.contract_count > 0;
      });
      
      resolve(result);
    });
  });
}

// 구글 스프레드시트에서 데이터 가져와서 DB에 저장
async function syncWithGoogleSheet() {
  try {
    // 게임 정보 스프레드시트에서 데이터 가져오기
    const games = await googleSheets.fetchGameData();
    
    // 현재 DB에 있는 게임 데이터 가져오기
    const existingGames = await getAllGames();
    
    // 게임 이름과 회사 이름으로 구성된 맵 생성
    const existingGameMap = {};
    existingGames.forEach(game => {
      const key = `${game.game_name}_${game.company_name}`.toLowerCase();
      existingGameMap[key] = game;
    });
    
    // 각 게임 처리
    const updatePromises = games.map(game => {
      const key = `${game.game_name}_${game.company_name}`.toLowerCase();
      
      if (existingGameMap[key]) {
        // 이미 존재하는 게임 업데이트
        return updateGame(existingGameMap[key].id, game);
      } else {
        // 새로운 게임 추가
        return addGame(game);
      }
    });
    
    // 모든 게임 데이터 추가/업데이트 작업 완료 대기
    await Promise.all(updatePromises);
    
    // 계약 정보 스프레드시트에서 데이터 가져오기
    const contracts = await googleSheets.fetchContractData();
    
    // 각 계약 정보 처리
    const contractPromises = contracts.map(contract => {
      return saveContract(contract);
    });
    
    // 모든 계약 정보 추가/업데이트 작업 완료 대기
    await Promise.all(contractPromises);
    
    // 마지막 동기화 시간 업데이트
    const currentTime = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE app_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'last_sync_time'`,
        [currentTime],
        function(err) {
          if (err) {
            console.error('마지막 동기화 시간 업데이트 오류:', err);
            reject(err);
            return;
          }
          
          if (this.changes === 0) {
            // 레코드가 없으면 새로 생성
            db.run(
              `INSERT INTO app_settings (setting_key, setting_value) VALUES ('last_sync_time', ?)`,
              [currentTime],
              function(insertErr) {
                if (insertErr) {
                  console.error('마지막 동기화 시간 삽입 오류:', insertErr);
                  reject(insertErr);
                  return;
                }
                
                resolve({ 
                  success: true, 
                  message: '데이터 동기화 완료', 
                  gameCount: games.length,
                  contractCount: contracts.length,
                  lastSyncTime: currentTime
                });
              }
            );
          } else {
            resolve({ 
              success: true, 
              message: '데이터 동기화 완료', 
              gameCount: games.length,
              contractCount: contracts.length,
              lastSyncTime: currentTime
            });
          }
        }
      );
    });
  } catch (error) {
    console.error('데이터 동기화 오류:', error);
    throw error;
  }
}

// 마지막 동기화 시간 조회
function getLastSyncTime() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT setting_value FROM app_settings WHERE setting_key = 'last_sync_time'`,
      [],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(row ? row.setting_value : null);
      }
    );
  });
}

// 다음 동기화 정보 조회 (마지막 동기화 시간, 다음 동기화까지 남은 시간)
async function getNextSyncInfo() {
  try {
    const lastSyncTimeStr = await getLastSyncTime();
    
    if (!lastSyncTimeStr) {
      return {
        lastSync: null,
        nextSync: null,
        remainingMinutes: null
      };
    }
    
    const lastSyncTime = new Date(lastSyncTimeStr);
    
    // 30분 간격으로 다음 동기화 시간 계산
    const nextSyncTime = new Date(lastSyncTime);
    nextSyncTime.setMinutes(lastSyncTime.getMinutes() + 30);
    
    // 현재 시간
    const now = new Date();
    
    // 남은 시간 계산 (밀리초 단위)
    let remainingTime = nextSyncTime - now;
    
    // 이미 다음 동기화 시간이 지났다면 재계산
    if (remainingTime < 0) {
      // 가장 최근 30분 간격 시간 계산
      const minutesSinceLastSync = Math.floor((now - lastSyncTime) / (1000 * 60));
      const intervals = Math.floor(minutesSinceLastSync / 30);
      
      // 다음 동기화 시간 재계산
      nextSyncTime.setMinutes(lastSyncTime.getMinutes() + ((intervals + 1) * 30));
      remainingTime = nextSyncTime - now;
    }
    
    // 분 단위로 변환
    const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));
    
    return {
      lastSync: lastSyncTime,
      nextSync: nextSyncTime,
      remainingMinutes
    };
  } catch (error) {
    console.error('다음 동기화 정보 조회 오류:', error);
    throw error;
  }
}

// PointUsageDB 업데이트 함수
async function updatePointUsageDB() {
  try {
    console.log('PointUsageDB 업데이트 시작');
    
    // 최종계약체결된 계약만 가져오기
    const query = `
      SELECT * FROM contracts 
      WHERE status = '최종계약체결' 
      ORDER BY company_name, selection_deadline
    `;
    
    return new Promise((resolve, reject) => {
      db.all(query, [], async (err, contracts) => {
        if (err) {
          console.error('최종계약체결 계약 조회 오류:', err);
          reject(err);
          return;
        }
        
        try {
          console.log(`총 ${contracts.length}개의 최종계약체결 계약 조회됨`);
          
          // 각 계약의 pointUsageDBCode 확인 (DB에 저장된 계약코드)
          const contractsWithCodes = await Promise.all(contracts.map(async (contract) => {
            // 기존 계약코드 조회
            const codeQuery = `SELECT point_usage_db_code FROM contract_meta WHERE contract_id = ?`;
            
            return new Promise((resolveContract, rejectContract) => {
              db.get(codeQuery, [contract.contract_id], (codeErr, row) => {
                if (codeErr) {
                  console.error(`계약 ${contract.contract_id}의 코드 조회 오류:`, codeErr);
                  rejectContract(codeErr);
                  return;
                }
                
                // 기존 코드 있으면 추가, 없으면 null로 처리
                return resolveContract({
                  ...contract,
                  pointUsageDBCode: row ? row.point_usage_db_code : null
                });
              });
            });
          }));
          
          // Google 스프레드시트에 업데이트
          const result = await googleSheets.updatePointUsageDB(contractsWithCodes);
          
          // 반환된 계약코드를 DB에 저장
          const codeUpdatePromises = [];
          
          for (let i = 0; i < contractsWithCodes.length; i++) {
            const contract = contractsWithCodes[i];
            if (!contract.pointUsageDBCode) {
              // 새로 생성된 계약코드를 할당해야 함
              // 모든 새 계약코드는 T로 시작하는 패턴을 따름
              const nextCode = `T${(i + 1).toString().padStart(5, '0')}`;
              
              codeUpdatePromises.push(
                new Promise((resolveUpdate, rejectUpdate) => {
                  // 먼저 기존 메타데이터 확인
                  db.get(
                    `SELECT * FROM contract_meta WHERE contract_id = ?`,
                    [contract.contract_id],
                    (metaErr, metaRow) => {
                      if (metaErr) {
                        console.error(`계약 ${contract.contract_id}의 메타데이터 조회 오류:`, metaErr);
                        rejectUpdate(metaErr);
                        return;
                      }
                      
                      if (metaRow) {
                        // 기존 메타데이터 업데이트
                        db.run(
                          `UPDATE contract_meta SET point_usage_db_code = ?, updated_at = CURRENT_TIMESTAMP WHERE contract_id = ?`,
                          [nextCode, contract.contract_id],
                          (updateErr) => {
                            if (updateErr) {
                              console.error(`계약 ${contract.contract_id}의 코드 업데이트 오류:`, updateErr);
                              rejectUpdate(updateErr);
                              return;
                            }
                            resolveUpdate();
                          }
                        );
                      } else {
                        // 새 메타데이터 생성
                        db.run(
                          `INSERT INTO contract_meta (contract_id, point_usage_db_code) VALUES (?, ?)`,
                          [contract.contract_id, nextCode],
                          (insertErr) => {
                            if (insertErr) {
                              console.error(`계약 ${contract.contract_id}의 코드 삽입 오류:`, insertErr);
                              rejectUpdate(insertErr);
                              return;
                            }
                            resolveUpdate();
                          }
                        );
                      }
                    }
                  );
                })
              );
            }
          }
          
          await Promise.all(codeUpdatePromises);
          
          resolve({
            success: true,
            message: 'PointUsageDB 업데이트 완료',
            ...result
          });
        } catch (processError) {
          console.error('PointUsageDB 업데이트 처리 오류:', processError);
          reject(processError);
        }
      });
    });
  } catch (error) {
    console.error('PointUsageDB 업데이트 오류:', error);
    throw error;
  }
}

module.exports = {
  getAllGames,
  getAllGamesWithPointUsage,
  getAllGamesWithPointUsageAndCategories,
  addGame,
  updateGame,
  getPointsByCompany,
  getPointsByCompanies,
  saveContract,
  getContractsByCompany,
  getCompanyContractStatus,
  syncWithGoogleSheet,
  getLastSyncTime,
  getNextSyncInfo,
  updatePointUsageDB
}; 