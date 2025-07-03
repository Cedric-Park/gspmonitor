const db = require('./db/database');

// 데이터베이스 연결 메시지
console.log('SQLite 데이터베이스에 연결되었습니다.');
console.log('데이터베이스 경로:', require('path').resolve('./db/game_points.db'));

// 피벗게임즈 게임 정보 조회
console.log('\n=== 피벗게임즈 게임 정보 조회 ===');
db.all("SELECT * FROM games WHERE company_name = '피벗게임즈'", [], (err, games) => {
  if (err) {
    console.error('게임 정보 조회 오류:', err);
    process.exit(1);
  }
  
  console.log('게임 정보:');
  console.log(games);
  
  if (games.length === 0) {
    console.log('피벗게임즈 게임 정보가 없습니다.');
    process.exit(0);
  }
  
  const gameId = games[0].id;
  
  // 모든 계약 정보 조회
  console.log('\n=== 피벗게임즈 모든 계약 정보 조회 ===');
  db.all("SELECT * FROM contracts WHERE assigned_game_id = ?", [gameId], (err, allContracts) => {
    if (err) {
      console.error('계약 정보 조회 오류:', err);
      process.exit(1);
    }
    
    console.log('모든 계약 정보:');
    console.log(allContracts);
    
    // 최종계약체결 상태인 계약 조회
    console.log('\n=== 피벗게임즈 최종계약체결 상태 계약 정보 조회 ===');
    db.all("SELECT * FROM contracts WHERE assigned_game_id = ? AND status = '최종계약체결'", [gameId], (err, finalContracts) => {
      if (err) {
        console.error('최종계약체결 계약 정보 조회 오류:', err);
        process.exit(1);
      }
      
      console.log('최종계약체결 계약 정보:');
      console.log(finalContracts);
      
      // 최종계약체결이 아니지만 계약금액과 선정협력사가 있는 계약 조회
      console.log('\n=== 피벗게임즈 최종계약체결이 아니지만 계약금액과 선정협력사가 있는 계약 정보 조회 ===');
      db.all("SELECT * FROM contracts WHERE assigned_game_id = ? AND status != '최종계약체결' AND selected_vendor IS NOT NULL AND contract_amount IS NOT NULL AND contract_amount != ''", [gameId], (err, nonFinalContracts) => {
        if (err) {
          console.error('비최종계약체결 계약 정보 조회 오류:', err);
          process.exit(1);
        }
        
        console.log('최종계약체결이 아니지만 계약금액과 선정협력사가 있는 계약 정보:');
        console.log(nonFinalContracts);
        
        process.exit(0);
      });
    });
  });
}); 