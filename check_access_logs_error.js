const db = require('./db/database');

// 접속 로그 테이블 구조 확인 및 오류 진단
function checkAccessLogsTableStructure() {
  console.log('📊 접속 로그 테이블 오류 진단 스크립트 시작...');
  
  // 직접 쿼리 실행
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='access_logs'", (err, table) => {
    if (err) {
      console.error('테이블 확인 오류:', err);
      process.exit(1);
      return;
    }
    
    console.log('테이블 존재 여부:', table ? '✅ 존재함' : '❌ 존재하지 않음');
    
    if (table) {
      // 테이블 구조 확인
      db.all("PRAGMA table_info(access_logs)", (err, columns) => {
        if (err) {
          console.error('컬럼 정보 조회 오류:', err);
          process.exit(1);
          return;
        }
        
        console.log('📋 테이블 구조:');
        columns.forEach(col => {
          console.log(`  - ${col.name} (${col.type})`);
        });
        
        // 데이터 확인
        db.all("SELECT COUNT(*) as count FROM access_logs", (err, result) => {
          if (err) {
            console.error('데이터 카운트 오류:', err);
            process.exit(1);
            return;
          }
          
          console.log(`📊 access_logs 테이블에 ${result[0].count}개의 로그가 있습니다.`);
          
          // 샘플 데이터 확인
          db.all(`
            SELECT al.*, m.name as manager_name, m.email as manager_email
            FROM access_logs al
            LEFT JOIN managers m ON al.manager_id = m.id
            ORDER BY al.id DESC LIMIT 1
          `, (err, rows) => {
            if (err) {
              console.error('샘플 데이터 조회 오류:', err);
              console.error('오류 메시지:', err.message);
              process.exit(1);
              return;
            }
            
            if (rows && rows.length > 0) {
              console.log('✅ 샘플 데이터:');
              console.log(rows[0]);
            } else {
              console.log('⚠️ 데이터가 없습니다.');
            }
            
            // managers 테이블 확인
            db.all("SELECT id, name, email FROM managers LIMIT 3", (err, managers) => {
              if (err) {
                console.error('managers 테이블 조회 오류:', err);
                process.exit(1);
                return;
              }
              
              console.log('\n📋 managers 테이블 샘플:');
              if (managers && managers.length > 0) {
                managers.forEach(manager => {
                  console.log(`  - ID: ${manager.id}, 이름: ${manager.name}, 이메일: ${manager.email}`);
                });
              } else {
                console.log('  ⚠️ 데이터가 없습니다.');
              }
              
              console.log('\n✅ 진단 완료!');
              process.exit(0);
            });
          });
        });
      });
    } else {
      console.log('❌ access_logs 테이블이 존재하지 않습니다!');
      console.log('🔧 테이블을 생성해야 합니다.');
      process.exit(1);
    }
  });
}

// 스크립트 실행
checkAccessLogsTableStructure();

// 5초 후에 강제 종료 (데이터베이스 연결 문제 대비)
setTimeout(() => {
  console.log('⚠️ 시간 초과로 스크립트를 종료합니다.');
  process.exit(1);
}, 5000); 