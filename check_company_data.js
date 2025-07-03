const db = require('./db/database');

// 데이터베이스 연결 확인
db.serialize(() => {
  console.log('데이터베이스 연결 테스트 중...');
  
  // 게임사 목록 조회
  db.all('SELECT DISTINCT company_name FROM games', [], (err, rows) => {
    if (err) {
      console.error('게임사 목록 조회 오류:', err);
    } else {
      console.log('게임사 목록:');
      rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.company_name}`);
      });
    }
    
    // 특정 게임사 데이터 확인
    const companyName = '넥셀론';
    console.log(`\n${companyName} 게임사 데이터 확인 중...`);
    
    // 게임 목록 조회
    db.all('SELECT * FROM games WHERE company_name = ?', [companyName], (err, games) => {
      if (err) {
        console.error(`${companyName} 게임 목록 조회 오류:`, err);
      } else {
        console.log(`${companyName} 게임 목록: ${games.length}개 게임 발견`);
        games.forEach((game, index) => {
          console.log(`${index + 1}. ${game.game_name} (${game.platform})`);
        });
      }
      
      // 성과 현황 테이블 확인
      db.all('SELECT name FROM sqlite_master WHERE type="table" AND name="game_performance"', [], (err, tables) => {
        if (err) {
          console.error('테이블 확인 오류:', err);
        } else {
          if (tables.length > 0) {
            console.log('\n성과 현황 테이블이 존재합니다.');
            
            // 성과 현황 데이터 확인
            db.all('SELECT * FROM game_performance WHERE company_name = ? LIMIT 5', [companyName], (err, data) => {
              if (err) {
                console.error(`${companyName} 성과 현황 데이터 조회 오류:`, err);
              } else {
                console.log(`${companyName} 성과 현황 데이터: ${data.length}개 데이터 발견`);
                if (data.length > 0) {
                  console.log('샘플 데이터:');
                  console.log(data[0]);
                } else {
                  console.log('성과 현황 데이터가 없습니다.');
                }
              }
              
              // 테이블 구조 확인
              db.all('PRAGMA table_info(game_performance)', [], (err, columns) => {
                if (err) {
                  console.error('테이블 구조 조회 오류:', err);
                } else {
                  console.log('\n성과 현황 테이블 구조:');
                  columns.forEach(col => {
                    console.log(`${col.name} (${col.type})`);
                  });
                }
                
                // 데이터베이스 연결 종료
                console.log('\n데이터베이스 확인 완료');
                process.exit(0);
              });
            });
          } else {
            console.log('\n성과 현황 테이블이 존재하지 않습니다.');
            process.exit(0);
          }
        }
      });
    });
  });
}); 