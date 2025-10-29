/**
 * 접속 로그의 날짜를 7월 12일에서 7월 11일로 변경하는 스크립트
 */

const db = require('./db/database');

console.log(`접속 로그 날짜 수정 시작 (7월 12일 -> 7월 11일)...`);

// 모든 접속 로그 가져오기
db.all("SELECT * FROM access_logs", (err, rows) => {
  if (err) {
    console.error('접속 로그 조회 오류:', err);
    process.exit(1);
  }
  
  console.log(`총 ${rows.length}개의 접속 로그를 찾았습니다.`);
  
  // 각 로그의 날짜 수정
  let updatedCount = 0;
  
  rows.forEach(log => {
    // login_time 수정 (7월 12일 -> 7월 11일)
    if (log.login_time && log.login_time.includes('2025-07-12')) {
      const newLoginTime = log.login_time.replace('2025-07-12', '2025-07-11');
      
      db.run(
        "UPDATE access_logs SET login_time = ? WHERE id = ?",
        [newLoginTime, log.id],
        function(err) {
          if (err) {
            console.error(`로그 ID ${log.id}의 login_time 업데이트 오류:`, err);
          } else {
            updatedCount++;
            console.log(`로그 ID ${log.id}: ${log.login_time} -> ${newLoginTime}`);
          }
        }
      );
    }
    
    // logout_time 수정 (있는 경우)
    if (log.logout_time && log.logout_time.includes('2025-07-12')) {
      const newLogoutTime = log.logout_time.replace('2025-07-12', '2025-07-11');
      
      db.run(
        "UPDATE access_logs SET logout_time = ? WHERE id = ?",
        [newLogoutTime, log.id],
        function(err) {
          if (err) {
            console.error(`로그 ID ${log.id}의 logout_time 업데이트 오류:`, err);
          } else {
            console.log(`로그 ID ${log.id} (로그아웃): ${log.logout_time} -> ${newLogoutTime}`);
          }
        }
      );
    }
  });
  
  // 완료 메시지 출력
  setTimeout(() => {
    console.log(`\n총 ${updatedCount}개의 접속 로그 날짜가 수정되었습니다.`);
    console.log('스크립트 실행이 완료되었습니다.');
    
    // 데이터베이스 연결 종료
    db.close();
  }, 1000);
}); 