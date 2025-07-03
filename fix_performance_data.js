const database = require('./db/database');

// 데이터베이스 연결 가져오기
async function getDb() {
  return new Promise((resolve, reject) => {
    // 데이터베이스 객체 가져오기
    const db = database.getDatabase();
    if (!db) {
      reject(new Error('데이터베이스 연결을 가져올 수 없습니다.'));
      return;
    }
    resolve(db);
  });
}

// 메인 함수
async function main() {
  try {
    console.log('성과 현황 데이터 수정 시작...');
    
    // 데이터베이스 연결 가져오기
    const db = await getDb();
    
    // 테이블 구조 확인
    const columns = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(game_performance)', [], (err, columns) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(columns);
      });
    });
    
    console.log('테이블 구조:');
    columns.forEach(col => {
      console.log(`${col.cid}. ${col.name} (${col.type})`);
    });
    
    // 넥셀론 게임사의 성과 현황 데이터 조회
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM game_performance WHERE company_name = "넥셀론" LIMIT 10', [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
    
    console.log(`\n넥셀론 게임사의 성과 현황 데이터 ${rows.length}개 조회 완료`);
    if (rows.length > 0) {
      console.log('첫 번째 데이터:');
      console.log(rows[0]);
    }
    
    // 테스트 쿼리 실행
    const testQuery = `
      SELECT date, SUM(revenue_global) as value
      FROM game_performance
      WHERE company_name = ?
      GROUP BY strftime('%Y-%m-%d', date)
      ORDER BY date ASC
    `;
    
    const results = await new Promise((resolve, reject) => {
      db.all(testQuery, ['넥셀론'], (err, results) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results);
      });
    });
    
    console.log('\n테스트 쿼리 실행 결과:');
    console.log(results);
    
    // 테스트 URL 출력
    console.log('\n테스트 URL:');
    console.log('http://localhost:3000/games/company/넥셀론');
    
    console.log('\n성과 현황 데이터 수정 완료');
    
  } catch (error) {
    console.error('오류 발생:', error);
    process.exit(1);
  }
}

// 메인 함수 실행
main(); 