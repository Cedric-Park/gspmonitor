const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// 환경 변수 설정
dotenv.config();

// MongoDB 연결 문자열
const uri = process.env.MONGODB_URI || 'mongodb+srv://rionaid81:roU7EBn1uTVy7Z0G@cluster01.kjpr3ku.mongodb.net/game_points?retryWrites=true&w=majority&appName=Cluster01';

async function createAdminUser() {
  let client;

  try {
    // MongoDB 클라이언트 생성 및 연결
    client = new MongoClient(uri);
    await client.connect();
    console.log('MongoDB 데이터베이스에 연결되었습니다.');

    // 데이터베이스 및 컬렉션 선택
    const db = client.db('game_points');
    const managersCollection = db.collection('managers');

    // 관리자 이메일
    const adminEmail = 'rionaid@com2us.com';

    // 기존 어드민 사용자 확인
    const existingAdmin = await managersCollection.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('어드민 계정이 이미 존재합니다.');
      return;
    }

    // 초기 비밀번호는 평문으로 저장 (1234)
    const initialPassword = '1234';

    // 어드민 사용자 생성
    const adminUser = {
      email: adminEmail,
      password: initialPassword, // 평문 비밀번호
      name: '박종철',
      role: '어드민',
      created_at: new Date(),
      updated_at: new Date()
    };

    // 데이터베이스에 사용자 추가
    const result = await managersCollection.insertOne(adminUser);
    console.log('어드민 계정이 생성되었습니다:', result.insertedId);

  } catch (error) {
    console.error('어드민 계정 생성 오류:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB 연결이 종료되었습니다.');
    }
  }
}

// 스크립트 실행
createAdminUser(); 