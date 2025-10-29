const db = require('./db/database');

// 접속 로그 테이블 확인 및 생성
function checkAccessLogsTable() {
  return new Promise((resolve, reject) => {
    // 테이블 존재 여부 확인
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='access_logs'", (err, table) => {
      if (err) {
        console.error('테이블 확인 오류:', err);
        reject(err);
        return;
      }

      if (table) {
        console.log('✅ access_logs 테이블이 이미 존재합니다.');
        resolve(true);
      } else {
        console.log('❌ access_logs 테이블이 존재하지 않습니다. 테이블을 생성합니다...');
        
        // 접속 로그 테이블 생성
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
        `, (createErr) => {
          if (createErr) {
            console.error('접속 로그 테이블 생성 오류:', createErr);
            reject(createErr);
          } else {
            console.log('✅ access_logs 테이블이 성공적으로 생성되었습니다.');
            resolve(true);
          }
        });
      }
    });
  });
}

// 테이블 구조 확인
function checkTableColumns() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(access_logs)", (err, columns) => {
      if (err) {
        console.error('컬럼 정보 조회 오류:', err);
        reject(err);
        return;
      }
      
      console.log('📋 access_logs 테이블 구조:');
      columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
      });
      
      resolve(columns);
    });
  });
}

// 테이블 데이터 확인
function checkTableData() {
  return new Promise((resolve, reject) => {
    db.all("SELECT COUNT(*) as count FROM access_logs", (err, result) => {
      if (err) {
        console.error('데이터 조회 오류:', err);
        reject(err);
        return;
      }
      
      console.log(`📊 access_logs 테이블에 ${result[0].count}개의 로그가 있습니다.`);
      
      // 최근 로그 5개 조회
      if (result[0].count > 0) {
        db.all(`
          SELECT al.*, m.name as manager_name, m.email as manager_email
          FROM access_logs al
          LEFT JOIN managers m ON al.manager_id = m.id
          ORDER BY al.login_time DESC LIMIT 5
        `, (dataErr, logs) => {
          if (dataErr) {
            console.error('최근 로그 조회 오류:', dataErr);
            reject(dataErr);
            return;
          }
          
          console.log('📝 최근 로그 5개:');
          logs.forEach(log => {
            console.log(`  - ID: ${log.id}, 담당자: ${log.manager_name || log.manager_email || '알 수 없음'}, 액션: ${log.action}, 시간: ${log.login_time}`);
          });
          
          resolve(logs);
        });
      } else {
        resolve([]);
      }
    });
  });
}

// 실행 함수
async function main() {
  try {
    console.log('📊 접속 로그 테이블 확인 스크립트 시작...');
    
    // 테이블 확인 및 생성
    await checkAccessLogsTable();
    
    // 테이블 구조 확인
    await checkTableColumns();
    
    // 테이블 데이터 확인
    await checkTableData();
    
    console.log('✅ 접속 로그 테이블 확인 완료!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main(); 