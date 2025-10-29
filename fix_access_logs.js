const db = require('./db/database');

// 접속 로그 테이블 문제 수정
function fixAccessLogsTable() {
  console.log('🔧 접속 로그 테이블 수정 스크립트 시작...');
  
  // 직접 쿼리 실행
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='access_logs'", (err, table) => {
    if (err) {
      console.error('테이블 확인 오류:', err);
      process.exit(1);
      return;
    }
    
    if (table) {
      console.log('✅ access_logs 테이블이 존재합니다. 테이블 구조를 확인합니다...');
      
      // 테이블 구조 확인
      db.all("PRAGMA table_info(access_logs)", (err, columns) => {
        if (err) {
          console.error('컬럼 정보 조회 오류:', err);
          process.exit(1);
          return;
        }
        
        console.log('📋 현재 테이블 구조:');
        columns.forEach(col => {
          console.log(`  - ${col.name} (${col.type})`);
        });
        
        // 데이터 백업
        console.log('\n📦 데이터 백업 중...');
        db.all("SELECT * FROM access_logs", (err, rows) => {
          if (err) {
            console.error('데이터 백업 오류:', err);
            process.exit(1);
            return;
          }
          
          console.log(`  - ${rows.length}개의 로그 데이터를 백업했습니다.`);
          
          // 테이블 삭제 및 재생성
          console.log('\n🔄 테이블 재생성 중...');
          db.run("DROP TABLE IF EXISTS access_logs", (err) => {
            if (err) {
              console.error('테이블 삭제 오류:', err);
              process.exit(1);
              return;
            }
            
            // 새 테이블 생성
            db.run(`
              CREATE TABLE IF NOT EXISTS access_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manager_id INTEGER,
                manager_name TEXT,
                manager_email TEXT,
                manager_role TEXT,
                action TEXT,
                ip_address TEXT,
                user_agent TEXT,
                login_status TEXT,
                login_time TEXT,
                logout_time TEXT,
                session_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (manager_id) REFERENCES managers (id)
              )
            `, (err) => {
              if (err) {
                console.error('테이블 생성 오류:', err);
                process.exit(1);
                return;
              }
              
              console.log('  - 테이블이 성공적으로 재생성되었습니다.');
              
              // 데이터 복원
              if (rows.length === 0) {
                console.log('  - 복원할 데이터가 없습니다.');
                console.log('\n✅ 테이블 수정이 완료되었습니다!');
                process.exit(0);
                return;
              }
              
              console.log('\n📥 데이터 복원 중...');
              let restored = 0;
              
              // 각 행을 개별적으로 삽입
              rows.forEach((row, index) => {
                const stmt = db.prepare(`
                  INSERT INTO access_logs (
                    id, manager_id, manager_name, manager_email, manager_role,
                    action, ip_address, user_agent, login_status,
                    login_time, logout_time, session_id, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                stmt.run(
                  row.id,
                  row.manager_id,
                  row.manager_name,
                  row.manager_email,
                  row.manager_role,
                  row.action,
                  row.ip_address,
                  row.user_agent,
                  row.login_status,
                  row.login_time,
                  row.logout_time,
                  row.session_id,
                  row.created_at,
                  function(err) {
                    if (err) {
                      console.error(`  - 행 ${index + 1} 복원 오류:`, err.message);
                    } else {
                      restored++;
                    }
                    
                    // 마지막 행 처리 후 완료 메시지
                    if (index === rows.length - 1) {
                      console.log(`  - ${restored}/${rows.length} 행이 성공적으로 복원되었습니다.`);
                      console.log('\n✅ 테이블 수정이 완료되었습니다!');
                      
                      // 테이블 확인
                      db.get("SELECT COUNT(*) as count FROM access_logs", (err, result) => {
                        if (err) {
                          console.error('데이터 확인 오류:', err);
                        } else {
                          console.log(`  - 현재 테이블에 ${result.count}개의 로그가 있습니다.`);
                        }
                        process.exit(0);
                      });
                    }
                  }
                );
                
                stmt.finalize();
              });
            });
          });
        });
      });
    } else {
      console.log('❌ access_logs 테이블이 존재하지 않습니다. 새로 생성합니다...');
      
      // 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS access_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          manager_id INTEGER,
          manager_name TEXT,
          manager_email TEXT,
          manager_role TEXT,
          action TEXT,
          ip_address TEXT,
          user_agent TEXT,
          login_status TEXT,
          login_time TEXT,
          logout_time TEXT,
          session_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (manager_id) REFERENCES managers (id)
        )
      `, (err) => {
        if (err) {
          console.error('테이블 생성 오류:', err);
          process.exit(1);
        } else {
          console.log('✅ 테이블이 성공적으로 생성되었습니다!');
          process.exit(0);
        }
      });
    }
  });
}

// 스크립트 실행
fixAccessLogsTable();

// 10초 후에 강제 종료 (데이터베이스 연결 문제 대비)
setTimeout(() => {
  console.log('⚠️ 시간 초과로 스크립트를 종료합니다.');
  process.exit(1);
}, 10000); 