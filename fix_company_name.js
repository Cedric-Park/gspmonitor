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
    
    // 1. 데이브 스튜디오와 데이브스튜디오 게임 정보 조회
    console.log('\n=== 수정 전 게임사 정보 조회 ===');
    db.all(`SELECT * FROM games WHERE company_name IN ('데이브 스튜디오', '데이브스튜디오')`, [], (err, games) => {
      if (err) {
        console.error('게임 정보 조회 오류:', err.message);
        db.run('ROLLBACK');
        db.close();
        return;
      }
      
      console.log('수정 전 게임 정보:');
      console.log(games);
      
      // 2. 데이브 스튜디오 담당자 정보 조회
      db.all(`
        SELECT cm.company_name, m.id as manager_id, m.name as manager_name, m.email
        FROM company_managers cm
        JOIN managers m ON cm.manager_id = m.id
        WHERE cm.company_name = '데이브 스튜디오'
      `, [], (err, managers) => {
        if (err) {
          console.error('담당자 정보 조회 오류:', err.message);
          db.run('ROLLBACK');
          db.close();
          return;
        }
        
        console.log('\n수정 전 담당자 정보:');
        console.log(managers);
        
        // 담당자가 없으면 오류 처리
        if (managers.length === 0) {
          console.error('데이브 스튜디오의 담당자 정보가 없습니다.');
          db.run('ROLLBACK');
          db.close();
          return;
        }
        
        const managerId = managers[0].manager_id;
        
        // 3. 데이브스튜디오 -> 데이브 스튜디오로 게임사 이름 변경
        db.run(`
          UPDATE games 
          SET company_name = '데이브 스튜디오', updated_at = CURRENT_TIMESTAMP 
          WHERE company_name = '데이브스튜디오'
        `, function(err) {
          if (err) {
            console.error('게임사 이름 변경 오류:', err.message);
            db.run('ROLLBACK');
            db.close();
            return;
          }
          
          console.log(`\n${this.changes}개의 게임 정보가 업데이트되었습니다.`);
          
          // 4. 데이브스튜디오 -> 데이브 스튜디오로 계약 정보 회사명 변경
          db.run(`
            UPDATE contracts 
            SET company_name = '데이브 스튜디오' 
            WHERE company_name = '데이브스튜디오'
          `, function(err) {
            if (err) {
              console.error('계약 정보 변경 오류:', err.message);
              db.run('ROLLBACK');
              db.close();
              return;
            }
            
            console.log(`${this.changes}개의 계약 정보가 업데이트되었습니다.`);
            
            // 5. 데이브스튜디오 -> 데이브 스튜디오로 담당자 매핑 정보 변경
            db.run(`
              UPDATE company_managers 
              SET company_name = '데이브 스튜디오' 
              WHERE company_name = '데이브스튜디오'
            `, function(err) {
              if (err) {
                console.error('담당자 매핑 정보 변경 오류:', err.message);
                db.run('ROLLBACK');
                db.close();
                return;
              }
              
              console.log(`${this.changes}개의 담당자 매핑 정보가 업데이트되었습니다.`);
              
              // 6. 데이브스튜디오 -> 데이브 스튜디오로 알림 설정 변경
              db.run(`
                UPDATE notification_settings 
                SET company_name = '데이브 스튜디오' 
                WHERE company_name = '데이브스튜디오'
              `, function(err) {
                if (err) {
                  console.error('알림 설정 변경 오류:', err.message);
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
                    db.close();
                    return;
                  }
                  
                  console.log('\n모든 작업이 성공적으로 완료되었습니다.');
                  
                  // 변경 후 게임사 정보 확인
                  console.log('\n=== 수정 후 게임사 정보 조회 ===');
                  db.all(`SELECT * FROM games WHERE company_name = '데이브 스튜디오'`, [], (err, updatedGames) => {
                    if (err) {
                      console.error('게임 정보 조회 오류:', err.message);
                      db.close();
                      return;
                    }
                    
                    console.log('수정 후 게임 정보:');
                    console.log(updatedGames);
                    
                    // 변경 후 담당자 정보 확인
                    db.all(`
                      SELECT cm.company_name, m.id as manager_id, m.name as manager_name, m.email
                      FROM company_managers cm
                      JOIN managers m ON cm.manager_id = m.id
                      WHERE cm.company_name = '데이브 스튜디오'
                    `, [], (err, updatedManagers) => {
                      if (err) {
                        console.error('담당자 정보 조회 오류:', err.message);
                        db.close();
                        return;
                      }
                      
                      console.log('\n수정 후 담당자 정보:');
                      console.log(updatedManagers);
                      
                      // 데이터베이스 연결 종료
                      db.close();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}); 