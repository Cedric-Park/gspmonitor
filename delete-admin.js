const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// 환경 변수 설정
dotenv.config();

// MongoDB 연결 문자열
const uri = process.env.MONGODB_URI || 'mongodb+srv://rionaid81:roU7EBn1uTVy7Z0G@cluster01.kjpr3ku.mongodb.net/game_points?retryWrites=true&w=majority&appName=Cluster01';

async function deleteAdminUser() {
  let client;

  try {
    // MongoDB 클라이언트 생성 및 연결
    client = new MongoClient(uri);
    await client.connect();
    console.log('MongoDB 데이터베이스에 연결되었습니다.');

    // 데이터베이스 및 컬렉션 선택
    const db = client.db('game_points');
    const managersCollection = db.collection('managers');

    // 모든 관리자 계정 삭제
    const result = await managersCollection.deleteMany({});
    console.log(`${result.deletedCount}개의 관리자 계정이 삭제되었습니다.`);

  } catch (error) {
    console.error('관리자 계정 삭제 오류:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB 연결이 종료되었습니다.');
    }
  }
}

// 스크립트 실행
deleteAdminUser(); 