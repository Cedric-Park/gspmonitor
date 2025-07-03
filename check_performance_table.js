const db = require('./db/database');

// 데이터베이스 연결 확인
db.serialize(() => {
  console.log('성과 현황 테이블 확인 중...');
  
  // 테이블 존재 여부 확인
  db.all('SELECT name FROM sqlite_master WHERE type="table" AND name="game_performance"', [], (err, tables) => {
    if (err) {
      console.error('테이블 확인 오류:', err);
      process.exit(1);
    }
    
    if (tables.length === 0) {
      console.log('game_performance 테이블이 존재하지 않습니다.');
      process.exit(0);
    }
    
    console.log('game_performance 테이블이 존재합니다.');
    
    // 테이블 구조 확인
    db.all('PRAGMA table_info(game_performance)', [], (err, columns) => {
      if (err) {
        console.error('테이블 구조 확인 오류:', err);
        process.exit(1);
      }
      
      console.log('\n테이블 구조:');
      columns.forEach(col => {
        console.log(`${col.cid}. ${col.name} (${col.type})`);
      });
      
      // 샘플 데이터 확인
      db.all('SELECT * FROM game_performance LIMIT 3', [], (err, rows) => {
        if (err) {
          console.error('데이터 조회 오류:', err);
          process.exit(1);
        }
        
        console.log('\n샘플 데이터:');
        if (rows.length > 0) {
          console.log(JSON.stringify(rows, null, 2));
        } else {
          console.log('데이터가 없습니다.');
        }
        
        // 넥셀론 게임사의 성과 현황 데이터 확인
        const companyName = '넥셀론';
        db.all('SELECT * FROM game_performance WHERE company_name = ? LIMIT 5', [companyName], (err, companyRows) => {
          if (err) {
            console.error(`${companyName} 데이터 조회 오류:`, err);
            process.exit(1);
          }
          
          console.log(`\n${companyName} 게임사의 성과 현황 데이터:`);
          if (companyRows.length > 0) {
            console.log(`${companyRows.length}개의 데이터가 있습니다.`);
            console.log(JSON.stringify(companyRows, null, 2));
          } else {
            console.log(`${companyName} 게임사의 성과 현황 데이터가 없습니다.`);
          }
          
          // 데이터 개수 확인
          db.get('SELECT COUNT(*) as count FROM game_performance', [], (err, result) => {
            if (err) {
              console.error('데이터 개수 확인 오류:', err);
              process.exit(1);
            }
            
            console.log(`\n총 ${result.count}개의 성과 현황 데이터가 있습니다.`);
            process.exit(0);
          });
        });
      });
    });
  });
}); 