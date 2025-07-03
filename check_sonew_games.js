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
  
  // 쏘뉴 게임사의 게임 조회
  db.all(`SELECT * FROM games WHERE company_name = '쏘뉴'`, [], (err, rows) => {
    if (err) {
      console.error('쿼리 실행 오류:', err.message);
      return;
    }
    
    console.log('쏘뉴 게임사의 게임 목록:');
    console.log(rows);
    
    // 데이터베이스 연결 종료
    db.close();
  });
}); 