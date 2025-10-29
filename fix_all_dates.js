const db = require('./db/database');

// 모든 접속 로그 날짜 수정 스크립트
function fixAllDates() {
  console.log('🔧 모든 접속 로그 날짜 수정 스크립트 시작...');
  
  // 현재 날짜 구하기
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // 접속 로그 조회
  db.all("SELECT id, login_time, logout_time FROM access_logs ORDER BY id", (err, rows) => {
    if (err) {
      console.error('접속 로그 조회 오류:', err);
      process.exit(1);
      return;
    }
    
    console.log(`📋 총 ${rows.length}개의 접속 로그를 확인합니다.`);
    
    // 날짜 수정
    let updatedCount = 0;
    let pendingUpdates = 0;
    
    rows.forEach(row => {
      let needsUpdate = false;
      let loginTime = null;
      let logoutTime = null;
      
      // 로그인 시간 확인 및 수정
      if (row.login_time) {
        try {
          // ISO 문자열에서 날짜 정보 추출
          const loginDate = new Date(row.login_time);
          
          if (isNaN(loginDate.getTime())) {
            console.log(`  - ID ${row.id}: 잘못된 로그인 시간 형식 - ${row.login_time}`);
            loginTime = row.login_time; // 형식이 잘못된 경우 원래 값 유지
          } else {
            // 연도가 현재 연도와 다른 경우 수정
            if (loginDate.getFullYear() !== currentYear) {
              needsUpdate = true;
              
              // 날짜 정보 추출
              const year = currentYear;
              const month = String(loginDate.getMonth() + 1).padStart(2, '0');
              const day = String(loginDate.getDate()).padStart(2, '0');
              const hours = String(loginDate.getHours()).padStart(2, '0');
              const minutes = String(loginDate.getMinutes()).padStart(2, '0');
              const seconds = String(loginDate.getSeconds()).padStart(2, '0');
              const milliseconds = String(loginDate.getMilliseconds()).padStart(3, '0');
              
              // 새 날짜 문자열 생성
              loginTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
              console.log(`  - ID ${row.id}: 로그인 시간 수정 ${row.login_time} → ${loginTime}`);
            } else {
              loginTime = row.login_time;
            }
          }
        } catch (e) {
          console.error(`  - ID ${row.id}: 로그인 시간 처리 오류 - ${e.message}`);
          loginTime = row.login_time;
        }
      }
      
      // 로그아웃 시간 확인 및 수정
      if (row.logout_time) {
        try {
          // ISO 문자열에서 날짜 정보 추출
          const logoutDate = new Date(row.logout_time);
          
          if (isNaN(logoutDate.getTime())) {
            console.log(`  - ID ${row.id}: 잘못된 로그아웃 시간 형식 - ${row.logout_time}`);
            logoutTime = row.logout_time; // 형식이 잘못된 경우 원래 값 유지
          } else {
            // 연도가 현재 연도와 다른 경우 수정
            if (logoutDate.getFullYear() !== currentYear) {
              needsUpdate = true;
              
              // 날짜 정보 추출
              const year = currentYear;
              const month = String(logoutDate.getMonth() + 1).padStart(2, '0');
              const day = String(logoutDate.getDate()).padStart(2, '0');
              const hours = String(logoutDate.getHours()).padStart(2, '0');
              const minutes = String(logoutDate.getMinutes()).padStart(2, '0');
              const seconds = String(logoutDate.getSeconds()).padStart(2, '0');
              const milliseconds = String(logoutDate.getMilliseconds()).padStart(3, '0');
              
              // 새 날짜 문자열 생성
              logoutTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
              console.log(`  - ID ${row.id}: 로그아웃 시간 수정 ${row.logout_time} → ${logoutTime}`);
            } else {
              logoutTime = row.logout_time;
            }
          }
        } catch (e) {
          console.error(`  - ID ${row.id}: 로그아웃 시간 처리 오류 - ${e.message}`);
          logoutTime = row.logout_time;
        }
      }
      
      // 업데이트가 필요한 경우
      if (needsUpdate) {
        pendingUpdates++;
        
        const query = `
          UPDATE access_logs
          SET login_time = ?, logout_time = ?
          WHERE id = ?
        `;
        
        db.run(query, [loginTime, logoutTime, row.id], function(err) {
          if (err) {
            console.error(`  - ID ${row.id} 업데이트 오류:`, err);
          } else {
            updatedCount++;
            console.log(`  - ID ${row.id} 업데이트 완료`);
          }
          
          pendingUpdates--;
          if (pendingUpdates === 0) {
            console.log(`\n✅ 총 ${updatedCount}개의 로그 날짜가 수정되었습니다.`);
            
            // 확인을 위해 최근 로그 5개 조회
            db.all("SELECT id, login_time, logout_time FROM access_logs ORDER BY id DESC LIMIT 5", (err, recent) => {
              if (err) {
                console.error('최근 로그 조회 오류:', err);
              } else {
                console.log('\n📋 최근 로그 5개:');
                recent.forEach(log => {
                  console.log(`  - ID ${log.id}: 로그인 ${log.login_time}, 로그아웃 ${log.logout_time || '없음'}`);
                });
              }
              process.exit(0);
            });
          }
        });
      }
    });
    
    // 업데이트가 필요한 항목이 없는 경우
    if (pendingUpdates === 0) {
      console.log('\n✅ 수정이 필요한 로그가 없습니다.');
      process.exit(0);
    }
  });
}

// 스크립트 실행
fixAllDates();

// 10초 후에 강제 종료 (데이터베이스 연결 문제 대비)
setTimeout(() => {
  console.log('⚠️ 시간 초과로 스크립트를 종료합니다.');
  process.exit(1);
}, 10000); 