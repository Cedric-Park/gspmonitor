/**
 * 접속 로그 데이터를 확인하는 스크립트
 */

const db = require('./db/database');

console.log('접속 로그 데이터 확인 중...');

// 모든 접속 로그 가져오기
db.all("SELECT * FROM access_logs ORDER BY login_time DESC", (err, rows) => {
  if (err) {
    console.error('접속 로그 조회 오류:', err);
    process.exit(1);
  }
  
  console.log(`총 ${rows.length}개의 접속 로그를 찾았습니다.`);
  
  // 각 로그의 날짜 정보 출력
  rows.forEach(log => {
    console.log(`로그 ID ${log.id}:`);
    console.log(`  로그인 시간: ${log.login_time}`);
    console.log(`  로그아웃 시간: ${log.logout_time || '없음'}`);
    console.log(`  담당자 ID: ${log.manager_id}`);
    console.log(`  IP 주소: ${log.ip_address}`);
    console.log(`  액션: ${log.action}`);
    console.log('-------------------');
  });
  
  // 데이터베이스 연결 종료
  db.close();
}); 