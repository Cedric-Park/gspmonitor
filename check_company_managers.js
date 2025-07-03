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
  
  // 데이브스튜디오 게임 정보 조회
  console.log('\n=== 게임사 정보 조회 ===');
  db.all(`SELECT * FROM games WHERE company_name = '데이브스튜디오'`, [], (err, games) => {
    if (err) {
      console.error('게임 정보 조회 오류:', err.message);
      return;
    }
    
    console.log('게임 정보:');
    console.log(games);
    
    // 데이브스튜디오 담당자 정보 조회
    console.log('\n=== 게임사 담당자 정보 조회 ===');
    db.all(`
      SELECT cm.company_name, m.id as manager_id, m.name as manager_name, m.email
      FROM company_managers cm
      JOIN managers m ON cm.manager_id = m.id
      WHERE cm.company_name = '데이브스튜디오'
    `, [], (err, managers) => {
      if (err) {
        console.error('담당자 정보 조회 오류:', err.message);
        return;
      }
      
      console.log('담당자 정보:');
      console.log(managers);
      
      // 계약 정보 조회
      console.log('\n=== 계약 정보 조회 ===');
      db.all(`SELECT * FROM contracts WHERE company_name = '데이브스튜디오'`, [], (err, contracts) => {
        if (err) {
          console.error('계약 정보 조회 오류:', err.message);
          return;
        }
        
        console.log('계약 정보:');
        console.log(contracts);
        
        // 데이터베이스 연결 종료
        db.close();
      });
    });
  });
}); 