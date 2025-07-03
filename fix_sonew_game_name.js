const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 데이터베이스 파일 경로
const dbPath = path.resolve(path.join(__dirname, 'db', 'game_points.db'));

// 데이터베이스 연결
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('데이터베이스 연결 오류:', err.message);
    return;
  }
  console.log('SQLite 데이터베이스에 연결되었습니다.');
  console.log('데이터베이스 경로:', dbPath);
  
  // 트랜잭션 시작
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // 1. 기존 레스토랑마스터 게임 데이터 확인
    db.get(`SELECT * FROM games WHERE company_name = '쏘뉴' AND game_name = '레스토랑마스터'`, [], (err, oldGame) => {
      if (err) {
        console.error('기존 게임 조회 오류:', err.message);
        db.run('ROLLBACK');
        db.close();
        return;
      }
      
      if (!oldGame) {
        console.log('레스토랑마스터 게임을 찾을 수 없습니다.');
        db.run('ROLLBACK');
        db.close();
        return;
      }
      
      console.log('수정 전 레스토랑마스터 게임 정보:', oldGame);
      
      // 2. 치위찬관 게임 데이터 확인
      db.get(`SELECT * FROM games WHERE company_name = '쏘뉴' AND game_name = '치위찬관'`, [], (err, newGame) => {
        if (err) {
          console.error('신규 게임 조회 오류:', err.message);
          db.run('ROLLBACK');
          db.close();
          return;
        }
        
        if (!newGame) {
          console.log('치위찬관 게임을 찾을 수 없습니다.');
          db.run('ROLLBACK');
          db.close();
          return;
        }
        
        console.log('수정 전 치위찬관 게임 정보:', newGame);
        
        // 3. 계약 정보 업데이트 - 치위찬관 게임 ID를 참조하는 계약을 레스토랑마스터 게임 ID로 변경
        db.run(`UPDATE contracts SET assigned_game_id = ? WHERE assigned_game_id = ?`, 
          [oldGame.id, newGame.id], function(err) {
            if (err) {
              console.error('계약 정보 업데이트 오류:', err.message);
              db.run('ROLLBACK');
              db.close();
              return;
            }
            
            console.log(`${this.changes}개의 계약 정보가 업데이트되었습니다.`);
            
            // 4. 레스토랑마스터 게임 이름을 치위찬관으로 변경
            db.run(`UPDATE games SET game_name = '치위찬관', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, 
              [oldGame.id], function(err) {
                if (err) {
                  console.error('게임 이름 업데이트 오류:', err.message);
                  db.run('ROLLBACK');
                  db.close();
                  return;
                }
                
                console.log(`레스토랑마스터 -> 치위찬관으로 이름 변경 완료 (ID: ${oldGame.id})`);
                
                // 5. 중복된 치위찬관 게임 삭제
                db.run(`DELETE FROM games WHERE id = ?`, [newGame.id], function(err) {
                  if (err) {
                    console.error('중복 게임 삭제 오류:', err.message);
                    db.run('ROLLBACK');
                    db.close();
                    return;
                  }
                  
                  console.log(`중복된 치위찬관 게임 삭제 완료 (ID: ${newGame.id})`);
                  
                  // 6. 알림 설정 업데이트 - 게임 이름 변경
                  db.run(`UPDATE notification_settings SET game_name = '치위찬관' 
                    WHERE company_name = '쏘뉴' AND game_name = '레스토랑마스터'`, function(err) {
                    if (err) {
                      console.error('알림 설정 업데이트 오류:', err.message);
                      db.run('ROLLBACK');
                      db.close();
                      return;
                    }
                    
                    console.log(`${this.changes}개의 알림 설정이 업데이트되었습니다.`);
                    
                    // 트랜잭션 커밋
                    db.run('COMMIT', (err) => {
                      if (err) {
                        console.error('트랜잭션 커밋 오류:', err.message);
                        db.run('ROLLBACK');
                      } else {
                        console.log('모든 작업이 성공적으로 완료되었습니다.');
                        
                        // 변경 후 쏘뉴 게임사의 게임 목록 확인
                        db.all(`SELECT * FROM games WHERE company_name = '쏘뉴'`, [], (err, rows) => {
                          if (err) {
                            console.error('게임 목록 조회 오류:', err.message);
                          } else {
                            console.log('변경 후 쏘뉴 게임사의 게임 목록:');
                            console.log(rows);
                          }
                          
                          // 데이터베이스 연결 종료
                          db.close();
                        });
                      }
                    });
                  });
                });
              });
          });
      });
    });
  });
}); 