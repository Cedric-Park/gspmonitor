// 구글 스프레드시트 데이터 가져오기 테스트 스크립트
const { testFetchGameData } = require('./models/googleSheets');

console.log('구글 스프레드시트 데이터 가져오기 테스트를 시작합니다...');

// 테스트 실행
testFetchGameData()
  .then(games => {
    if (games.length > 0) {
      console.log('테스트 성공! 게임 데이터를 가져왔습니다.');
      console.log(`총 ${games.length}개의 게임 데이터를 가져왔습니다.`);
      console.log('첫 번째 게임 데이터:', games[0]);
    } else {
      console.log('테스트 실패: 게임 데이터를 가져오지 못했습니다.');
    }
  })
  .catch(error => {
    console.error('테스트 중 오류 발생:', error);
  }); 